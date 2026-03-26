/**
 * Script to rebuild world places from the worlds content server.
 *
 * This script will:
 * 1. List all worlds with deployed scenes from the worlds content server
 * 2. For each world, fetch its scenes via the /scenes endpoint
 * 3. Re-run the same world processing logic used by the SQS task runner
 * 4. Insert/update places and world records in the database
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.development ts-node -r dotenv/config bin/rebuildWorldPlaces.ts [options]
 *   DOTENV_CONFIG_PATH=.env.production ts-node -r dotenv/config bin/rebuildWorldPlaces.ts [options]
 *
 * Options:
 *   --dry-run                Preview changes without updating the database
 *   --limit N                Limit the number of worlds to process
 *   --world-name NAME        Process only a specific world
 *   --connection-string URL  Override the CONNECTION_STRING environment variable
 *
 * Examples:
 *   DOTENV_CONFIG_PATH=.env.development ts-node -r dotenv/config bin/rebuildWorldPlaces.ts --dry-run --limit 5
 *   DOTENV_CONFIG_PATH=.env.production ts-node -r dotenv/config bin/rebuildWorldPlaces.ts --world-name "myworld.dcl.eth"
 */

import { randomUUID } from "crypto"

import database from "decentraland-gatsby/dist/entities/Database/database"
import logger from "decentraland-gatsby/dist/entities/Development/logger"
import {
  ContentEntityScene,
  SceneContentRating,
} from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import env from "decentraland-gatsby/dist/utils/env"
import fetch from "node-fetch"

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
import PlaceModel from "../src/entities/Place/model"
import { DisabledReason, PlaceAttributes } from "../src/entities/Place/types"
import PlaceCategories from "../src/entities/PlaceCategories/model"
import PlaceContentRatingModel from "../src/entities/PlaceContentRating/model"
import WorldModel from "../src/entities/World/model"

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

interface Stats {
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

const placesAttributes: Array<keyof PlaceAttributes> = [
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
  "disabled_at",
  "disabled_reason",
  "created_at",
  "updated_at",
  "deployed_at",
  "world",
  "world_name",
  "world_id",
  "textsearch",
  "creator_address",
  "sdk",
]

// ── CLI Argument Parsing ───────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")

  const limitIndex = args.indexOf("--limit")
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : null

  const worldNameIndex = args.indexOf("--world-name")
  const worldName = worldNameIndex !== -1 ? args[worldNameIndex + 1] : null

  const connStringIndex = args.indexOf("--connection-string")
  const connectionString =
    connStringIndex !== -1 ? args[connStringIndex + 1] : null

  return { dryRun, limit, worldName, connectionString }
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
      `    [DRY-RUN] Would set categories: ${validCategoriesArray.join(", ")}`
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

  while (true) {
    const url = `${baseUrl}/worlds?has_deployed_scenes=true&limit=${WORLDS_PAGE_SIZE}&offset=${offset}`
    const response = await fetch(url)
    if (!response.ok) {
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

async function fetchWorldScenes(
  baseUrl: string,
  worldName: string
): Promise<WorldScenesResponse["scenes"]> {
  const url = `${baseUrl}/world/${encodeURIComponent(worldName)}/scenes`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch scenes for ${worldName}: ${response.status} ${response.statusText}`
    )
  }

  const data = (await response.json()) as WorldScenesResponse
  return data.scenes
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
    logger.log(`    Skipping scene ${scene.entityId}: no worldConfiguration`)
    stats.skipped++
    return { processedPlaceId: null, disabledPlaceIds: [] }
  }

  const worldName = (contentEntityScene.metadata.worldConfiguration.name ||
    contentEntityScene.metadata.worldConfiguration.dclName) as string

  if (!worldName) {
    logger.log(
      `    Skipping scene ${scene.entityId}: worldConfiguration without name`
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
    logger.log(`    WARNING: Could not resolve on-chain owner for ${worldName}`)
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
        `    [DRY-RUN] Would create world: ${worldName} (owner: ${
          nameOwner || "unknown"
        })`
      )
    } else {
      const worldChanges: string[] = []
      if (nameOwner && existingWorld.owner !== nameOwner) {
        worldChanges.push(`owner: ${existingWorld.owner} → ${nameOwner}`)
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
        `    Creating world: ${worldName} (owner: ${nameOwner || "unknown"})`
      )
    } else {
      const worldChanges: string[] = []
      if (nameOwner && existingWorld.owner !== nameOwner) {
        worldChanges.push(`owner: ${existingWorld.owner} → ${nameOwner}`)
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
    await WorldModel.insertWorldIfNotExists({
      world_name: worldName,
      title:
        contentEntityScene?.metadata?.display?.title?.slice(0, 50) || undefined,
      description:
        contentEntityScene?.metadata?.display?.description || undefined,
      content_rating:
        (contentEntityScene?.metadata?.policy
          ?.contentRating as SceneContentRating) || undefined,
      categories: contentEntityScene?.metadata?.tags || undefined,
      owner: nameOwner || undefined,
      show_in_places: !isOptOut,
    })

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

  const options = {
    url: worldsContentServerUrl,
    creator: sceneJsonData.creator,
    sdk: sceneJsonData.runtimeVersion,
    worldId,
  }

  // Build placesToProcess using the same logic as taskRunnerSqs
  let placesToProcess: ProcessEntitySceneResult | null = null

  // Stale deployment protection: skip if a newer deployment already exists
  const newerPlace = findNewDeployedPlace(contentEntityScene, overlappingPlaces)
  if (newerPlace) {
    logger.log(`    Skipping scene ${scene.entityId}: newer deployment exists`)
    stats.skipped++
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
        `    [DRY-RUN] Would create place: "${place.title}" at ${place.base_position} (id: ${place.id})`
      )
    } else {
      logger.log(
        `    Created place: "${place.title}" at ${place.base_position} (id: ${place.id})`
      )
      await PlaceModel.insertPlace(place, placesAttributes)
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
          `    [DRY-RUN] No changes for place: "${place.title}" at ${place.base_position} (id: ${place.id})`
        )
      } else {
        logger.log(
          `    [DRY-RUN] Would update place: "${place.title}" at ${place.base_position} (id: ${place.id})`
        )
        for (const diff of diffs) {
          logger.log(`      ${diff.field}: ${diff.oldVal} → ${diff.newVal}`)
        }
        stats.updated++
      }
    } else {
      logger.log(
        `    Updated place: "${place.title}" at ${place.base_position} (id: ${place.id})`
      )
      await PlaceModel.updatePlace(place, placesAttributes)
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
        } place(s): ${placesIdToDisable.join(", ")}`
      )
    } else {
      logger.log(
        `    Disabled ${
          placesIdToDisable.length
        } place(s): ${placesIdToDisable.join(", ")}`
      )
      await PlaceModel.disablePlaces(placesIdToDisable)
    }
    stats.disabled += placesIdToDisable.length
  }

  const processedPlace = placesToProcess.new || placesToProcess.update
  return { processedPlaceId: processedPlace?.id || null, disabledPlaceIds }
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
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
  logger.log(`World filter: ${worldName || "All worlds"}`)
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
      logger.log(`[${i + 1}/${worlds.length}] Processing world: ${world.name}`)

      try {
        const scenes = await fetchWorldScenes(
          worldsContentServerUrl,
          world.name
        )
        logger.log(`  Found ${scenes.length} scene(s)`)

        const knownPlaceIds = new Set<string>()

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
            }
            for (const id of result.disabledPlaceIds) {
              knownPlaceIds.add(id)
            }
          } catch (err: any) {
            logger.error(
              `  Error processing scene ${scene.entityId}: ${err.message}`
            )
            stats.errored++
          }
        }

        // Detect orphan places: active places in this world that have no
        // corresponding scene in the content server
        const worldId = world.name.toLowerCase()
        const allWorldPlaces = await PlaceModel.findByWorldId(worldId)
        const orphanPlaces = allWorldPlaces.filter(
          (p) => !p.disabled && !knownPlaceIds.has(p.id)
        )

        if (orphanPlaces.length > 0) {
          const orphanIds = orphanPlaces.map((p) => p.id)
          if (dryRun) {
            logger.log(
              `  [DRY-RUN] Would disable ${orphanPlaces.length} orphan place(s) with no matching scene:`
            )
            for (const p of orphanPlaces) {
              logger.log(
                `    - "${p.title}" at ${p.base_position} (id: ${p.id})`
              )
            }
          } else {
            await PlaceModel.disablePlaces(orphanIds)
            logger.log(
              `  Disabled ${orphanPlaces.length} orphan place(s) with no matching scene:`
            )
            for (const p of orphanPlaces) {
              logger.log(
                `    - "${p.title}" at ${p.base_position} (id: ${p.id})`
              )
            }
          }
          stats.disabled += orphanPlaces.length
        }
      } catch (err: any) {
        logger.error(
          `  Error fetching scenes for ${world.name}: ${err.message}`
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
      logger.log("Run without --dry-run to apply changes.")
    }

    // Close database connection
    try {
      await database.close()
    } catch {
      // ignore close errors
    }
  }
}

// Run the script
main().catch((error) => {
  logger.error("Script failed:", error)
  process.exit(1)
})
