/**
 * Script to rebuild world places from the worlds content server.
 *
 * This script will:
 * 1. List all worlds with deployed scenes from the worlds content server
 * 2. For each world, fetch its scenes via the /scenes endpoint
 * 3. Re-run the same world processing logic used by the SQS task runner
 * 4. Insert/update places and world records in the database
 *
 * Offline tool: run it with the scene consumer stopped. It writes places directly rather than through
 * the deployment path, so it consults none of the undeployment guards and takes the per-world
 * deployment lock only around the orphan sweep, where a concurrent deployment would otherwise have its
 * fresh place disabled as an orphan. The insert, update and overlap-resolution writes are not under
 * that lock, so running this against a live consumer can interleave with an in-flight deployment for
 * the same world and let the older of the two win. Stopping the consumer is what makes that
 * impossible; narrowing it to a lock held across each world's whole body is follow-up work.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.development ts-node -r dotenv/config bin/rebuildWorldPlaces.ts [options]
 *   DOTENV_CONFIG_PATH=.env.production ts-node -r dotenv/config bin/rebuildWorldPlaces.ts [options]
 *
 * Options:
 *   --apply                  Commit the rebuild. Without it the run is a dry run and rolls back.
 *   --dry-run                Ask for a dry run explicitly, which is also the default
 *   --limit N                Limit the number of worlds to process
 *   --world-name NAME        Process only a specific world
 *   --connection-string URL  Override the CONNECTION_STRING environment variable
 *
 * Examples:
 *   DOTENV_CONFIG_PATH=.env.development ts-node -r dotenv/config bin/rebuildWorldPlaces.ts --limit 5
 *   DOTENV_CONFIG_PATH=.env.production ts-node -r dotenv/config bin/rebuildWorldPlaces.ts --apply --world-name "myworld.dcl.eth"
 */

import { randomUUID } from "crypto"

import database from "decentraland-gatsby/dist/entities/Database/database"
import logger from "decentraland-gatsby/dist/entities/Development/logger"
import { ContentEntityScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import env from "decentraland-gatsby/dist/utils/env"

import {
  REBUILD_PLACE_ATTRIBUTES,
  createWorldInsertData,
  createWorldPlaceOptions,
} from "./rebuildWorldPlacesOptions"
import { ScriptArgs, parseScriptArgs } from "./scriptArgs"
import { forTerminal } from "./scriptTerminalText"
import CategoryModel from "../src/entities/Category/model"
import { DecentralandCategories } from "../src/entities/Category/types"
import { extractSceneJsonData } from "../src/entities/CheckScenes/task/extractSceneJsonData"
import {
  ProcessEntitySceneResult,
  createPlaceFromContentEntityScene,
} from "../src/entities/CheckScenes/task/processContentEntityScene"
import {
  fetchNameOwner,
  findNewDeployedPlace,
} from "../src/entities/CheckScenes/utils"
import { withDatabaseTransaction } from "../src/entities/Database/model"
import PlaceModel from "../src/entities/Place/model"
import { DisabledReason, PlaceAttributes } from "../src/entities/Place/types"
import PlaceCategories from "../src/entities/PlaceCategories/model"
import PlaceContentRatingModel from "../src/entities/PlaceContentRating/model"
import WorldModel from "../src/entities/World/model"
import { drainResponse } from "../src/utils/fetch"

// ── Types ──────────────────────────────────────────────────────────────

interface WorldsListResponse {
  worlds: Array<{ name: string; owner: string }>
  total: number
}

interface WorldScenesResponse {
  scenes: Array<{
    worldName: string
    entityId: string
    deployer: string
    entity: ContentEntityScene
    parcels: string[]
    size: string
    createdAt: string
  }>
  total: number
}

export interface Stats {
  created: number
  updated: number
  disabled: number
  skipped: number
  errored: number
}

interface SceneResult {
  processedPlaceId: string | null
  disabledPlaceIds: string[]
}

// ── Constants ──────────────────────────────────────────────────────────

const DELAY_BETWEEN_WORLDS_MS = 100
const WORLDS_PAGE_SIZE = 100
/** Worlds Content Server caps and defaults its scene pages at 100 rows. */
const SCENES_PAGE_SIZE = 100
/** Backstop against a total that never agrees with the rows served. */
const SCENES_MAX_PAGES = 200
/** Per request, matching the service's own reader. */
const SCENES_FETCH_TIMEOUT_MS = 15_000
/** The whole read, so a slow listing cannot stall a run that disables places. */
const SCENES_READ_DEADLINE_MS = 60_000
/** How many times to re-read a multi-page listing looking for two that agree. */
const STABLE_READ_ATTEMPTS = 3

// ── CLI Argument Parsing ───────────────────────────────────────────────

function parseArgs(): ScriptArgs {
  return parseScriptArgs(process.argv.slice(2))
}

// ── Category Helpers (from taskRunnerSqs) ──────────────────────────────

async function getValidCategories(creatorTags: string[]) {
  const forbidden = [
    DecentralandCategories.POI,
    DecentralandCategories.FEATURED,
  ] as string[]

  const availableCategories = await CategoryModel.findActiveCategories()
  const validCategories = new Set<string>()

  for (const tag of creatorTags) {
    if (forbidden.includes(tag)) continue
    if (availableCategories.find(({ name }) => name === tag)) {
      validCategories.add(tag)
    }
    if (validCategories.size === 3) break
  }

  return validCategories
}

async function overridePlaceCategories(
  placeId: string,
  creatorTags: string[],
  dryRun: boolean
) {
  if (!creatorTags.length) return

  const [validCategories, currentCategoryRows] = await Promise.all([
    getValidCategories(creatorTags),
    PlaceCategories.findCategoriesByPlaceId(placeId),
  ])

  if (!validCategories.size) return

  const currentCategories = new Set(
    currentCategoryRows.map(({ category_id }) => category_id)
  )

  if (currentCategories.has(DecentralandCategories.POI)) {
    validCategories.add(DecentralandCategories.POI)
  }

  if (currentCategories.has(DecentralandCategories.FEATURED)) {
    validCategories.add(DecentralandCategories.FEATURED)
  }

  const validCategoriesArray = Array.from(validCategories)

  if (dryRun) {
    logger.log(
      `    [DRY-RUN] Would set categories: ${forTerminal(
        validCategoriesArray.join(", ")
      )}`
    )
    return
  }

  await Promise.all([
    PlaceCategories.cleanPlaceCategories(placeId),
    PlaceModel.overrideCategories(placeId, validCategoriesArray),
  ])

  await PlaceCategories.addCategoriesToPlaces(
    validCategoriesArray.map((category) => [placeId, category])
  )
}

// ── Fetch Helpers ──────────────────────────────────────────────────────

async function fetchAllWorlds(
  baseUrl: string,
  worldNameFilter: string | null,
  limit: number | null
): Promise<Array<{ name: string }>> {
  if (worldNameFilter) {
    return [{ name: worldNameFilter }]
  }

  const allWorlds: Array<{ name: string }> = []
  let offset = 0

  for (;;) {
    const url = `${baseUrl}/worlds?has_deployed_scenes=true&limit=${WORLDS_PAGE_SIZE}&offset=${offset}`
    const response = await fetch(url, {
      signal: AbortSignal.timeout(SCENES_FETCH_TIMEOUT_MS),
      redirect: "error",
    })
    if (!response.ok) {
      await drainResponse(response)
      throw new Error(
        `Failed to fetch worlds list: ${response.status} ${response.statusText}`
      )
    }

    const data = (await response.json()) as WorldsListResponse
    allWorlds.push(...data.worlds)

    if (
      allWorlds.length >= data.total ||
      data.worlds.length < WORLDS_PAGE_SIZE
    ) {
      break
    }
    offset += WORLDS_PAGE_SIZE
  }

  if (limit && allWorlds.length > limit) {
    return allWorlds.slice(0, limit)
  }

  return allWorlds
}

/**
 * Read every scene a world serves.
 *
 * The listing is paginated and caps a page at SCENES_PAGE_SIZE rows. Reading only the first page
 * would hide the rest of a large world, and orphan detection below disables the active places that
 * no scene in this list accounts for, so a short read would disable live places.
 */
export async function fetchWorldScenes(
  baseUrl: string,
  worldName: string
): Promise<WorldScenesResponse["scenes"]> {
  let read = await readScenePages(baseUrl, worldName)

  // One page is one query upstream, so it is already a consistent snapshot. More than one is paged by
  // offset over a listing ordered without a tiebreaker, where a removal before the next offset and an
  // addition after the end keep the total unchanged, repeat nothing, and still hide a live scene --
  // whose place the orphan sweep below would then disable. Agreement between two whole reads stands in
  // for the snapshot the server does not offer. Every world today is a single page.
  if (read.pages <= 1) return read.scenes

  for (let attempt = 2; attempt <= STABLE_READ_ATTEMPTS; attempt++) {
    const again = await readScenePages(baseUrl, worldName)
    if (fingerprintScenes(read.scenes) === fingerprintScenes(again.scenes)) {
      return again.scenes
    }
    read = again
  }

  throw new Error(
    `Could not read a stable scene listing for ${worldName} across ${STABLE_READ_ATTEMPTS} attempts; skipping this world rather than judging its places against a torn reading`
  )
}

/** Order-independent identity of a whole listing, for comparing two reads of it. */
function fingerprintScenes(scenes: WorldScenesResponse["scenes"]): string {
  return scenes
    .map(
      (scene) =>
        `${scene.entityId}|${scene.entity?.metadata?.scene?.base}|${
          scene.entity?.timestamp
        }|${[...(scene.parcels || [])].sort().join(",")}`
    )
    .sort()
    .join(";")
}

async function readScenePages(
  baseUrl: string,
  worldName: string
): Promise<{ scenes: WorldScenesResponse["scenes"]; pages: number }> {
  const scenes: WorldScenesResponse["scenes"] = []
  let total: number | null = null
  let pages = 0
  const deadline = Date.now() + SCENES_READ_DEADLINE_MS

  for (let page = 0; page < SCENES_MAX_PAGES; page++) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      throw new Error(
        `Timed out reading the scenes of ${worldName} after ${
          SCENES_READ_DEADLINE_MS / 1000
        }s; skipping this world rather than judging its places against a partial listing`
      )
    }

    const url = `${baseUrl}/world/${encodeURIComponent(
      worldName
    )}/scenes?limit=${SCENES_PAGE_SIZE}&offset=${scenes.length}`
    const response = await fetch(url, {
      signal: AbortSignal.timeout(Math.min(remaining, SCENES_FETCH_TIMEOUT_MS)),
      // the trusted host is what makes this answer authoritative; a redirect would move it elsewhere
      redirect: "error",
    })
    if (!response.ok) {
      await drainResponse(response)
      throw new Error(
        `Failed to fetch scenes for ${worldName}: ${response.status} ${response.statusText}`
      )
    }

    const data = (await response.json()) as WorldScenesResponse
    if (!Array.isArray(data.scenes)) {
      throw new Error(`Unexpected scenes response for ${worldName}`)
    }
    // The listing is ordered by creation with no tiebreaker and paged by offset, so a scene removed
    // mid-read slides rows past the offset unseen. A total that disagrees with the first page's is
    // that shift, and without a total there is nothing to check the read against.
    if (typeof data.total !== "number") {
      throw new Error(
        `Scenes response for ${worldName} does not report how many scenes it has`
      )
    }
    if (total === null) {
      total = data.total
    } else if (data.total !== total) {
      throw new Error(
        `Scenes for ${worldName} changed while being read: ${total} scenes, then ${data.total}`
      )
    }

    scenes.push(...data.scenes)
    pages++

    if (data.scenes.length < SCENES_PAGE_SIZE) break
    if (total !== null && scenes.length >= total) break
  }

  if (scenes.length !== total) {
    throw new Error(
      `Content server served ${scenes.length} of ${total} scenes for ${worldName}`
    )
  }

  // Deployment ids are unique per world upstream, so a duplicate means a page repeated a scene in
  // place of one it skipped -- and orphan detection would then disable the live place it missed.
  if (new Set(scenes.map((scene) => scene.entityId)).size !== scenes.length) {
    throw new Error(
      `Content server repeated a scene while serving ${worldName}; the listing shifted mid-read`
    )
  }

  return { scenes, pages }
}

// ── Dry-Run Diff Helper ────────────────────────────────────────────────

const DIFF_FIELDS: Array<keyof PlaceAttributes> = [
  "title",
  "description",
  "image",
  "owner",
  "positions",
  "base_position",
  "contact_name",
  "contact_email",
  "content_rating",
  "disabled",
  "disabled_reason",
  "creator_address",
  "sdk",
  "deployed_at",
  "updated_at",
  "world_name",
  "world_id",
  "deployment_id",
]

function getPlaceDiffs(
  existing: PlaceAttributes,
  updated: PlaceAttributes
): Array<{ field: string; oldVal: string; newVal: string }> {
  const diffs: Array<{ field: string; oldVal: string; newVal: string }> = []
  for (const field of DIFF_FIELDS) {
    const oldVal = JSON.stringify(existing[field])
    const newVal = JSON.stringify(updated[field])
    if (oldVal !== newVal) {
      diffs.push({ field, oldVal, newVal })
    }
  }
  return diffs
}

// ── Core Scene Processing ──────────────────────────────────────────────

async function processWorldScene(
  scene: WorldScenesResponse["scenes"][number],
  worldsContentServerUrl: string,
  dryRun: boolean,
  stats: Stats
): Promise<SceneResult> {
  const contentEntityScene = scene.entity as ContentEntityScene

  if (!contentEntityScene.metadata?.worldConfiguration) {
    logger.log(
      `    Skipping scene ${forTerminal(scene.entityId)}: no worldConfiguration`
    )
    stats.skipped++
    return { processedPlaceId: null, disabledPlaceIds: [] }
  }

  const worldName = (contentEntityScene.metadata.worldConfiguration.name ||
    contentEntityScene.metadata.worldConfiguration.dclName) as string

  if (!worldName) {
    logger.log(
      `    Skipping scene ${forTerminal(
        scene.entityId
      )}: worldConfiguration without name`
    )
    stats.skipped++
    return { processedPlaceId: null, disabledPlaceIds: [] }
  }

  // Extract creator address and SDK version from scene.json
  const sceneJsonData = await extractSceneJsonData(
    contentEntityScene,
    worldsContentServerUrl
  )

  // Determine if opt-out is set
  const isOptOut =
    !!contentEntityScene?.metadata?.worldConfiguration?.placesConfig?.optOut

  // Resolve on-chain name owner
  const nameOwner = await fetchNameOwner(worldName)

  if (!nameOwner) {
    logger.log(
      `    WARNING: Could not resolve on-chain owner for ${forTerminal(
        worldName
      )}`
    )
  }

  // Ensure the place gets an owner: prefer deployment metadata, fall back to name owner
  if (!contentEntityScene.metadata.owner && nameOwner) {
    contentEntityScene.metadata.owner = nameOwner
  }

  // World ID is deterministic
  const worldId = worldName.toLowerCase()

  const existingWorld = await WorldModel.findByWorldName(worldName)

  if (dryRun) {
    if (!existingWorld) {
      logger.log(
        `    [DRY-RUN] Would create world: ${forTerminal(worldName)} (owner: ${
          nameOwner ? forTerminal(nameOwner) : "unknown"
        })`
      )
    } else {
      const worldChanges: string[] = []
      if (nameOwner && existingWorld.owner !== nameOwner) {
        worldChanges.push(
          `owner: ${forTerminal(existingWorld.owner)} → ${forTerminal(
            nameOwner
          )}`
        )
      }
      if (existingWorld.show_in_places !== !isOptOut) {
        worldChanges.push(
          `show_in_places: ${existingWorld.show_in_places} → ${!isOptOut}`
        )
      }
      if (worldChanges.length > 0) {
        logger.log(
          `    [DRY-RUN] Would update world: ${worldChanges.join(", ")}`
        )
      }
    }
  } else {
    if (!existingWorld) {
      logger.log(
        `    Creating world: ${forTerminal(worldName)} (owner: ${
          nameOwner ? forTerminal(nameOwner) : "unknown"
        })`
      )
    } else {
      const worldChanges: string[] = []
      if (nameOwner && existingWorld.owner !== nameOwner) {
        worldChanges.push(
          `owner: ${forTerminal(existingWorld.owner)} → ${forTerminal(
            nameOwner
          )}`
        )
      }
      if (existingWorld.show_in_places !== !isOptOut) {
        worldChanges.push(
          `show_in_places: ${existingWorld.show_in_places} → ${!isOptOut}`
        )
      }
      if (worldChanges.length > 0) {
        logger.log(`    Updating world: ${worldChanges.join(", ")}`)
      }
    }
    // Insert the world if it doesn't exist yet
    await WorldModel.insertWorldIfNotExists(
      createWorldInsertData(worldName, contentEntityScene, nameOwner, isOptOut)
    )

    // Update the world owner and fix show_in_places for worlds that were
    // stuck with show_in_places=false after the opt-out was removed
    await WorldModel.upsertWorld({
      world_name: worldName,
      ...(nameOwner && { owner: nameOwner }),
      show_in_places: !isOptOut,
    })
  }

  // Find overlapping places (read-only, always runs)
  const overlappingPlaces = await PlaceModel.findActiveByWorldIdAndPositions(
    worldId,
    contentEntityScene.pointers
  )

  const options = createWorldPlaceOptions(
    scene.entityId,
    worldsContentServerUrl,
    sceneJsonData.creator,
    sceneJsonData.runtimeVersion,
    worldId
  )

  // Build placesToProcess using the same logic as taskRunnerSqs
  let placesToProcess: ProcessEntitySceneResult | null = null

  // Stale deployment protection: skip if a newer deployment already exists
  const newerPlace = findNewDeployedPlace(contentEntityScene, overlappingPlaces)
  if (newerPlace) {
    logger.log(
      `    Skipping scene ${forTerminal(
        scene.entityId
      )}: newer deployment exists`
    )
    stats.skipped++
    // Nothing is returned as processed. Naming the newer place here would tell the orphan sweep that
    // the listing accounts for that row, which it does not -- the sweep would then judge the rest of
    // the world against a set containing a row no served scene produced. Counting the scene as
    // unaccounted instead skips the sweep for this world, which protects that newer place and every
    // other row here, and says why in the log.
    return { processedPlaceId: null, disabledPlaceIds: [] }
  } else if (overlappingPlaces.length === 1) {
    // Single overlap → update that place
    const existingPlace = overlappingPlaces[0]
    const place = createPlaceFromContentEntityScene(
      contentEntityScene,
      existingPlace,
      options
    )

    // Preserve existing content rating during rebuild
    if (existingPlace.content_rating) {
      place.content_rating = existingPlace.content_rating
    }

    // Preserve existing owner if we couldn't resolve one
    if (!place.owner && existingPlace.owner) {
      place.owner = existingPlace.owner
    }

    placesToProcess = { update: place, rating: null, disabled: [] }
  } else if (overlappingPlaces.length === 0) {
    // No overlapping places → create a new place
    const place = createPlaceFromContentEntityScene(
      contentEntityScene,
      {},
      options
    )

    placesToProcess = {
      new: place,
      rating: {
        id: randomUUID(),
        entity_id: place.id,
        original_rating: null,
        update_rating: place.content_rating,
        moderator: null,
        comment: null,
        created_at: new Date(),
      },
      disabled: [],
    }
  } else {
    // 2+ overlapping → update the most recently deployed, disable the rest
    const sorted = overlappingPlaces.sort(
      (a, b) =>
        new Date(b.deployed_at).getTime() - new Date(a.deployed_at).getTime()
    )
    const mostRecent = sorted[0]
    const stale = sorted.slice(1)

    const place = createPlaceFromContentEntityScene(
      contentEntityScene,
      mostRecent,
      options
    )

    // Preserve existing content rating during rebuild
    if (mostRecent.content_rating) {
      place.content_rating = mostRecent.content_rating
    }

    // Preserve existing owner if we couldn't resolve one
    if (!place.owner && mostRecent.owner) {
      place.owner = mostRecent.owner
    }

    placesToProcess = { update: place, rating: null, disabled: stale }
  }

  // Apply opt-out override
  if (placesToProcess) {
    const place = placesToProcess.new || placesToProcess.update
    if (isOptOut) {
      place.disabled = true
      place.disabled_reason = DisabledReason.OPT_OUT
      place.disabled_at = place.disabled_at || new Date()
    } else {
      place.disabled = false
      place.disabled_reason = null
      place.disabled_at = null
    }
  }

  if (!placesToProcess) {
    stats.skipped++
    return { processedPlaceId: null, disabledPlaceIds: [] }
  }

  const disabledPlaceIds = placesToProcess.disabled.map((p) => p.id)

  // ── Persist results ────────────────────────────────────────────────

  if (placesToProcess.new) {
    const place = placesToProcess.new
    if (dryRun) {
      logger.log(
        `    [DRY-RUN] Would create place: "${forTerminal(
          place.title
        )}" at ${forTerminal(place.base_position)} (id: ${forTerminal(
          place.id
        )})`
      )
    } else {
      logger.log(
        `    Created place: "${forTerminal(place.title)}" at ${forTerminal(
          place.base_position
        )} (id: ${forTerminal(place.id)})`
      )
      await PlaceModel.insertPlace(place, REBUILD_PLACE_ATTRIBUTES)
      await overridePlaceCategories(
        place.id,
        contentEntityScene.metadata.tags || [],
        dryRun
      )
    }
    stats.created++
  }

  if (placesToProcess.update) {
    const place = placesToProcess.update
    if (dryRun) {
      const existingPlace =
        overlappingPlaces.find((p) => p.id === place.id) || overlappingPlaces[0]
      const diffs = existingPlace ? getPlaceDiffs(existingPlace, place) : []
      if (diffs.length === 0) {
        logger.log(
          `    [DRY-RUN] No changes for place: "${forTerminal(
            place.title
          )}" at ${forTerminal(place.base_position)} (id: ${forTerminal(
            place.id
          )})`
        )
      } else {
        logger.log(
          `    [DRY-RUN] Would update place: "${forTerminal(
            place.title
          )}" at ${forTerminal(place.base_position)} (id: ${forTerminal(
            place.id
          )})`
        )
        for (const diff of diffs) {
          logger.log(
            `      ${forTerminal(diff.field)}: ${forTerminal(
              diff.oldVal
            )} → ${forTerminal(diff.newVal)}`
          )
        }
        stats.updated++
      }
    } else {
      logger.log(
        `    Updated place: "${forTerminal(place.title)}" at ${forTerminal(
          place.base_position
        )} (id: ${forTerminal(place.id)})`
      )
      await PlaceModel.updatePlace(place, REBUILD_PLACE_ATTRIBUTES)
      await overridePlaceCategories(
        place.id,
        contentEntityScene.metadata.tags || [],
        dryRun
      )
      stats.updated++
    }
  }

  if (placesToProcess.rating) {
    if (dryRun) {
      logger.log(`    [DRY-RUN] Would create content rating record`)
    } else {
      logger.log(`    Created content rating record`)
      await PlaceContentRatingModel.create(placesToProcess.rating)
    }
  }

  if (placesToProcess.disabled.length) {
    const placesIdToDisable = placesToProcess.disabled.map((place) => place.id)
    if (dryRun) {
      logger.log(
        `    [DRY-RUN] Would disable ${
          placesIdToDisable.length
        } place(s): ${forTerminal(placesIdToDisable.join(", "))}`
      )
    } else {
      logger.log(
        `    Disabled ${placesIdToDisable.length} place(s): ${forTerminal(
          placesIdToDisable.join(", ")
        )}`
      )
      await PlaceModel.disablePlaces(placesIdToDisable)
    }
    stats.disabled += placesIdToDisable.length
  }

  const processedPlace = placesToProcess.new || placesToProcess.update
  return { processedPlaceId: processedPlace?.id || null, disabledPlaceIds }
}

/**
 * Disable the active places of a world that no scene in the content server accounts for.
 *
 * Extracted so the destructive half of the rebuild can be reasoned about and tested on its own, and
 * so it can hold the per-world lock every other writer of world places takes. Without that lock the
 * listing was snapshotted, then the places read seconds later, and any deployment landing in between
 * produced an active place absent from both -- which this would disable.
 *
 * The places are re-read under the lock rather than trusting the ones read before it, and only rows
 * still at the revision that reading captured can be orphans.
 */
/**
 * The revision of every place a world holds, as `deployment_id|deployed_at`.
 *
 * Read before the content server is asked anything, so it describes the same moment the scene
 * listing does. Ids alone are not enough: a replacement reuses the row it replaces, so a row present
 * in both readings can still be a different revision by the time the sweep runs.
 */
export async function readPlaceRevisions(
  worldId: string
): Promise<Map<string, string>> {
  const places = await PlaceModel.findByWorldId(worldId)
  return new Map(places.map((place) => [place.id, revisionOf(place)]))
}

function revisionOf(place: PlaceAttributes): string {
  return `${place.deployment_id}|${place.deployed_at}`
}

/**
 * Rebuild one world: read its served scenes, apply each of them, then sweep orphans if -- and only if
 * -- this world's places can be judged complete against that listing.
 *
 * Extracted from main so the completeness rule is reachable from a test. It is the one rule here that
 * disables places from a derived argument rather than an event, and inspecting it was not enough: the
 * two mistakes found in it so far were both in which scenes count as accounted for.
 */
export async function rebuildWorld(options: {
  worldName: string
  worldsContentServerUrl: string
  dryRun: boolean
  stats: Stats
}): Promise<{ sweptOrphans: boolean; unaccountedScenes: number }> {
  const { worldName, worldsContentServerUrl, dryRun, stats } = options

  // Captured before the content server is asked, so the places and the scene listing describe
  // the same moment. knownPlaceIds is then accumulated from that listing, well before the
  // sweep takes its lock, so anything committed in between must not be judged by it.
  const worldId = worldName.toLowerCase()
  const placeRevisions = await readPlaceRevisions(worldId)

  const scenes = await fetchWorldScenes(worldsContentServerUrl, worldName)
  logger.log(`  Found ${scenes.length} scene(s)`)

  const knownPlaceIds = new Set<string>()
  let unaccountedScenes = 0

  for (const scene of scenes) {
    try {
      const result = await processWorldScene(
        scene,
        worldsContentServerUrl,
        dryRun,
        stats
      )
      if (result.processedPlaceId) {
        knownPlaceIds.add(result.processedPlaceId)
      } else {
        unaccountedScenes++
      }
      for (const id of result.disabledPlaceIds) {
        knownPlaceIds.add(id)
      }
    } catch (err: any) {
      logger.error(
        `  Error processing scene ${forTerminal(scene.entityId)}: ${forTerminal(
          err.message
        )}`
      )
      stats.errored++
      unaccountedScenes++
    }
  }

  // Detect orphan places: active places in this world that have no corresponding scene in the
  // content server.
  //
  // This is the only place in the repo that disables places from a derived argument rather
  // than an event, so it may only run on a complete picture of the world. A scene that threw,
  // or that was skipped without yielding a place, leaves its live place looking like an
  // orphan; and a world that answered with no scenes at all is indistinguishable from a name
  // that no longer resolves, which would take every place with it.
  const activePlaces = (await PlaceModel.findByWorldId(worldId)).filter(
    (place) => !place.disabled
  )

  if (unaccountedScenes > 0) {
    logger.log(
      `  Skipping orphan detection: ${unaccountedScenes} scene(s) yielded no place, so this world's places cannot be judged complete`
    )
    return { sweptOrphans: false, unaccountedScenes }
  }

  if (scenes.length === 0 && activePlaces.length > 0) {
    logger.log(
      `  Skipping orphan detection: the content server served no scenes for a world with ${activePlaces.length} active place(s), which reads the same as a name that no longer resolves`
    )
    return { sweptOrphans: false, unaccountedScenes }
  }

  await disableOrphanPlaces({
    worldName,
    worldId,
    knownPlaceIds,
    placeRevisions,
    dryRun,
    stats,
  })

  return { sweptOrphans: true, unaccountedScenes }
}

export async function disableOrphanPlaces(options: {
  worldName: string
  worldId: string
  knownPlaceIds: Set<string>
  placeRevisions: Map<string, string>
  dryRun: boolean
  stats: Stats
}): Promise<void> {
  const { worldName, worldId, knownPlaceIds, placeRevisions, dryRun, stats } =
    options

  const orphanPlaces = await withDatabaseTransaction(async () => {
    await WorldModel.lockWorldForDeployment(worldName)

    const orphans = (await PlaceModel.findByWorldId(worldId)).filter(
      (place) =>
        !place.disabled &&
        !knownPlaceIds.has(place.id) &&
        // Only a row still at the revision the scene listing was compared against. A row created or
        // replaced since then is not something this run's listing can speak about, and a replacement
        // keeps the same id, so the revision is what has to match rather than the id.
        placeRevisions.get(place.id) === revisionOf(place)
    )

    if (orphans.length > 0 && !dryRun) {
      await PlaceModel.disablePlaces(orphans.map((place) => place.id))
    }

    return orphans
  })

  if (orphanPlaces.length === 0) return

  logger.log(
    dryRun
      ? `  [DRY-RUN] Would disable ${orphanPlaces.length} orphan place(s) with no matching scene:`
      : `  Disabled ${orphanPlaces.length} orphan place(s) with no matching scene:`
  )
  for (const place of orphanPlaces) {
    logger.log(
      `    - "${forTerminal(place.title)}" at ${forTerminal(
        place.base_position
      )} (id: ${forTerminal(place.id)})`
    )
  }
  stats.disabled += orphanPlaces.length
}

// ── Main ───────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const { dryRun, limit, worldName, connectionString } = parseArgs()

  // Override CONNECTION_STRING if provided
  if (connectionString) {
    process.env.CONNECTION_STRING = connectionString
  }

  const worldsContentServerUrl = env(
    "WORLDS_CONTENT_SERVER_URL",
    "https://worlds-content-server.decentraland.org"
  ).replace(/\/+$/, "")

  logger.log("=".repeat(60))
  logger.log("Rebuild World Places Script")
  logger.log("=".repeat(60))
  logger.log(`Worlds Content Server: ${worldsContentServerUrl}`)
  logger.log(`Mode: ${dryRun ? "DRY RUN (no changes will be made)" : "LIVE"}`)
  logger.log(`Limit: ${limit || "No limit"}`)
  logger.log(
    `World filter: ${worldName ? forTerminal(worldName) : "All worlds"}`
  )
  logger.log("=".repeat(60))

  // Connect to database
  if (!dryRun) {
    if (!process.env.CONNECTION_STRING) {
      throw new Error(
        "CONNECTION_STRING environment variable is required (or use --connection-string)"
      )
    }
    await database.connect()
    logger.log("Database connected")
  } else {
    // Even in dry-run we need DB for read queries (finding overlapping places)
    if (process.env.CONNECTION_STRING) {
      await database.connect()
      logger.log("Database connected (read-only for dry-run)")
    } else {
      logger.log(
        "WARNING: No CONNECTION_STRING provided. Dry-run will skip DB read queries."
      )
    }
  }

  const stats: Stats = {
    created: 0,
    updated: 0,
    disabled: 0,
    skipped: 0,
    errored: 0,
  }

  try {
    // Fetch list of worlds
    logger.log("")
    logger.log("Fetching worlds list...")
    const worlds = await fetchAllWorlds(
      worldsContentServerUrl,
      worldName,
      limit
    )
    logger.log(`Found ${worlds.length} world(s) to process`)
    logger.log("")

    // Process each world
    for (let i = 0; i < worlds.length; i++) {
      const world = worlds[i]
      logger.log(
        `[${i + 1}/${worlds.length}] Processing world: ${forTerminal(
          world.name
        )}`
      )

      try {
        await rebuildWorld({
          worldName: world.name,
          worldsContentServerUrl,
          dryRun,
          stats,
        })
      } catch (err: any) {
        logger.error(
          `  Error rebuilding ${forTerminal(world.name)}: ${forTerminal(
            err.message
          )}`
        )
        stats.errored++
      }

      // Small delay between worlds to avoid rate-limiting
      if (i < worlds.length - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, DELAY_BETWEEN_WORLDS_MS)
        )
      }
    }
  } finally {
    // Print summary
    logger.log("")
    logger.log("=".repeat(60))
    logger.log("Summary")
    logger.log("=".repeat(60))
    logger.log(`  Created: ${stats.created}`)
    logger.log(`  Updated: ${stats.updated}`)
    logger.log(`  Disabled: ${stats.disabled}`)
    logger.log(`  Skipped: ${stats.skipped}`)
    logger.log(`  Errored: ${stats.errored}`)

    if (dryRun) {
      logger.log("")
      logger.log("This was a dry run. No changes were made to the database.")
      logger.log("Re-run with --apply to commit these changes.")
    }

    // Close database connection
    try {
      await database.close()
    } catch {
      // ignore close errors
    }
  }

  return stats.errored
}

if (require.main === module) {
  main()
    .then((errored) => {
      // This script inserts, updates and disables places. A world or scene it could not process is
      // partial work an operator has to know about, so it must not exit the same way a clean run does.
      if (errored > 0) process.exit(1)
    })
    .catch((error) => {
      logger.error("Script failed:", error)
      process.exit(1)
    })
}
