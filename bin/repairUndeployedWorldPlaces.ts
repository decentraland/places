/**
 * Repairs world scene places that an undeployment event disabled while the worlds content server
 * was still serving their scene.
 *
 * An undeployment event is stamped with the moment the removal was emitted, which is always later
 * than the entity timestamp of the deployment that caused it. Guards comparing the two therefore
 * treated a replacement as older than the removal of what it replaced and disabled it, and the
 * durable watermarks recorded with that same emission timestamp then rejected every later delivery
 * of the surviving deployment, so the place could not recover on its own.
 *
 * For each affected world this script:
 * 1. Reads the scenes the world serves now, which is the only authority on what survived
 * 2. Re-enables places whose deployment the world still serves
 * 3. Deletes only the watermark rows that would reject one of those surviving deployments
 *
 * Places whose scene is genuinely gone are left disabled, and watermarks that guard content the
 * world no longer serves are left in place.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.development ts-node -r dotenv/config bin/repairUndeployedWorldPlaces.ts [options]
 *   DOTENV_CONFIG_PATH=.env.production ts-node -r dotenv/config bin/repairUndeployedWorldPlaces.ts [options]
 *
 * Options:
 *   --dry-run                Report what would change and roll the transaction back
 *   --limit N                Repair at most N worlds
 *   --world-name NAME        Repair only a specific world
 *   --connection-string URL  Override the CONNECTION_STRING environment variable
 *
 * Examples:
 *   DOTENV_CONFIG_PATH=.env.production ts-node -r dotenv/config bin/repairUndeployedWorldPlaces.ts --dry-run
 *   DOTENV_CONFIG_PATH=.env.production ts-node -r dotenv/config bin/repairUndeployedWorldPlaces.ts --world-name "cyaiox.dcl.eth"
 */

import database from "decentraland-gatsby/dist/entities/Database/database"
import { SQL, table } from "decentraland-gatsby/dist/entities/Database/utils"
import logger from "decentraland-gatsby/dist/entities/Development/logger"
import env from "decentraland-gatsby/dist/utils/env"

import { withDatabaseTransaction } from "../src/entities/Database/model"
import PlaceModel from "../src/entities/Place/model"
import { DisabledReason } from "../src/entities/Place/types"
import WorldDeploymentPositionWatermarkModel from "../src/entities/WorldDeploymentPositionWatermark/model"
import WorldSceneUndeploymentModel from "../src/entities/WorldSceneUndeployment/model"
import WorldUndeploymentModel from "../src/entities/WorldUndeployment/model"
import { drainResponse } from "../src/utils/fetch"

// ── Types ──────────────────────────────────────────────────────────────

/** A scene the worlds content server serves right now. */
type ServedScene = {
  entityId: string
  base: string
  parcels: string[]
  deployedAt: Date
}

type DisabledPlace = {
  id: string
  title: string | null
  base_position: string
  positions: string[]
  deployment_id: string | null
}

type WorldRepair = {
  reenabledByIdentity: DisabledPlace[]
  reenabledByFootprint: Array<{ place: DisabledPlace; scene: ServedScene }>
  ambiguous: DisabledPlace[]
  stillGone: number
  worldWatermarksCleared: number
  sceneWatermarksCleared: number
  positionWatermarksCleared: number
}

type Stats = {
  worlds: number
  reenabled: number
  backfilled: number
  ambiguous: number
  watermarksCleared: number
  errored: number
}

// ── Constants ──────────────────────────────────────────────────────────

/** Worlds Content Server caps and defaults its scene pages at 100 rows. */
const SCENES_PAGE_SIZE = 100
const SCENES_MAX_PAGES = 200
const DELAY_BETWEEN_WORLDS_MS = 100

/** Thrown to roll a dry run back once its real effects have been measured. */
class DryRunRollback extends Error {
  constructor(public repair: WorldRepair) {
    super("dry run")
    this.name = "DryRunRollback"
  }
}

// ── Args ───────────────────────────────────────────────────────────────

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

// ── Content server ─────────────────────────────────────────────────────

/**
 * Read every scene a world serves. The listing is paginated and a short read would look like a
 * smaller world, which is the mistake this repair exists to undo, so the rows served are reconciled
 * against the reported total and anything short throws.
 */
async function fetchServedScenes(
  baseUrl: string,
  worldName: string
): Promise<ServedScene[]> {
  const scenes: ServedScene[] = []
  let total: number | null = null

  for (let page = 0; page < SCENES_MAX_PAGES; page++) {
    const url = `${baseUrl}/world/${encodeURIComponent(
      worldName
    )}/scenes?limit=${SCENES_PAGE_SIZE}&offset=${scenes.length}`
    const response = await fetch(url)
    if (!response.ok) {
      await drainResponse(response)
      throw new Error(
        `Failed to fetch scenes for ${worldName}: ${response.status} ${response.statusText}`
      )
    }

    const body = await response.json()
    if (!body || !Array.isArray(body.scenes)) {
      throw new Error(`Unexpected scenes response for ${worldName}`)
    }
    if (typeof body.total === "number") {
      total = body.total
    }

    for (const scene of body.scenes) {
      const base = scene?.entity?.metadata?.scene?.base
      const parcels = scene?.parcels
      const timestamp = scene?.entity?.timestamp
      if (
        typeof scene?.entityId !== "string" ||
        typeof base !== "string" ||
        !Array.isArray(parcels) ||
        parcels.length === 0 ||
        typeof timestamp !== "number"
      ) {
        throw new Error(
          `Scene ${scene?.entityId} of ${worldName} is missing the identity this repair matches on`
        )
      }
      scenes.push({
        entityId: scene.entityId,
        base,
        parcels,
        deployedAt: new Date(timestamp),
      })
    }

    if (body.scenes.length < SCENES_PAGE_SIZE) break
    if (total !== null && scenes.length >= total) break
  }

  if (total !== null && scenes.length !== total) {
    throw new Error(
      `Content server served ${scenes.length} of ${total} scenes for ${worldName}`
    )
  }

  return scenes
}

// ── Queries ────────────────────────────────────────────────────────────

async function findAffectedWorlds(
  worldName: string | null,
  limit: number | null
): Promise<string[]> {
  const rows = await PlaceModel.namedQuery<{ world_id: string }>(
    "repair_find_affected_worlds",
    SQL`
      SELECT DISTINCT "world_id"
      FROM ${table(PlaceModel)}
      WHERE "world" IS TRUE
        AND "disabled" IS TRUE
        AND "disabled_reason" = ${DisabledReason.UNDEPLOYMENT}
        AND "world_id" IS NOT NULL
        ${worldName ? SQL`AND "world_id" = ${worldName.toLowerCase()}` : SQL``}
      ORDER BY "world_id"
      ${limit ? SQL`LIMIT ${limit}` : SQL``}
    `
  )
  return rows.map((row) => row.world_id)
}

async function findDisabledPlaces(worldId: string): Promise<DisabledPlace[]> {
  return PlaceModel.namedQuery<DisabledPlace>(
    "repair_find_disabled_places",
    SQL`
      SELECT "id", "title", "base_position", "positions", "deployment_id"
      FROM ${table(PlaceModel)}
      WHERE "world" IS TRUE
        AND "world_id" = ${worldId}
        AND "disabled" IS TRUE
        AND "disabled_reason" = ${DisabledReason.UNDEPLOYMENT}
    `
  )
}

function sameFootprint(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const seen = new Set(left)
  return right.every((parcel) => seen.has(parcel))
}

/**
 * Re-enable the places whose deployment the world still serves.
 *
 * Identity is the authority: a stored deployment id the content server still lists proves the row
 * represents live content. Rows predating deployment ids are matched on their complete footprint
 * and base parcel instead, and only when exactly one served scene fits, so an ambiguous legacy row
 * is reported rather than guessed at. Those get their deployment id backfilled so the next
 * undeployment can judge them by identity.
 */
async function repairWorld(
  worldId: string,
  served: ServedScene[],
  dryRun: boolean
): Promise<WorldRepair> {
  const run = async (): Promise<WorldRepair> => {
    const now = new Date()
    const places = await findDisabledPlaces(worldId)
    const servedIds = new Set(served.map((scene) => scene.entityId))

    const reenabledByIdentity: DisabledPlace[] = []
    const reenabledByFootprint: Array<{
      place: DisabledPlace
      scene: ServedScene
    }> = []
    const ambiguous: DisabledPlace[] = []
    let stillGone = 0

    // Identity first, so a served scene already accounted for by a stored deployment id cannot also
    // be claimed by a legacy row that is really an older revision of it.
    const claimed = new Set<string>()
    const legacy: DisabledPlace[] = []

    for (const place of places) {
      if (!place.deployment_id) {
        legacy.push(place)
        continue
      }
      if (servedIds.has(place.deployment_id)) {
        reenabledByIdentity.push(place)
        claimed.add(place.deployment_id)
      } else {
        stillGone++
      }
    }

    for (const place of legacy) {
      const exact = served.filter(
        (scene) =>
          !claimed.has(scene.entityId) &&
          scene.base === place.base_position &&
          sameFootprint(scene.parcels, place.positions)
      )
      if (exact.length === 1) {
        reenabledByFootprint.push({ place, scene: exact[0] })
        claimed.add(exact[0].entityId)
        continue
      }

      // A served scene at this base that nothing else accounts for may be this very row with
      // parcels that drifted from the entity's pointers. Anything else at this base is a newer
      // deployment, which makes this row an older revision that is genuinely gone.
      const unclaimedAtBase = served.some(
        (scene) =>
          !claimed.has(scene.entityId) && scene.base === place.base_position
      )
      if (unclaimedAtBase) {
        ambiguous.push(place)
      } else {
        stillGone++
      }
    }

    if (reenabledByIdentity.length > 0) {
      await PlaceModel.namedQuery(
        "repair_reenable_by_identity",
        SQL`
          UPDATE ${table(PlaceModel)}
          SET "disabled" = FALSE,
            "disabled_at" = NULL,
            "disabled_reason" = NULL,
            "updated_at" = ${now}
          WHERE "id" = ANY(${reenabledByIdentity.map(
            (place) => place.id
          )}::uuid[])
            AND "disabled" IS TRUE
            AND "disabled_reason" = ${DisabledReason.UNDEPLOYMENT}
        `
      )
    }

    if (reenabledByFootprint.length > 0) {
      await PlaceModel.namedQuery(
        "repair_reenable_by_footprint",
        SQL`
          UPDATE ${table(PlaceModel)} target
          SET "disabled" = FALSE,
            "disabled_at" = NULL,
            "disabled_reason" = NULL,
            "deployment_id" = matched."deployment_id",
            "updated_at" = ${now}
          FROM unnest(
            ${reenabledByFootprint.map(({ place }) => place.id)}::uuid[],
            ${reenabledByFootprint.map(({ scene }) => scene.entityId)}::text[]
          ) AS matched("id", "deployment_id")
          WHERE target."id" = matched."id"
            AND target."disabled" IS TRUE
            AND target."disabled_reason" = ${DisabledReason.UNDEPLOYMENT}
        `
      )
    }

    // A world that still serves scenes was never torn down, so its full-world watermark can only
    // reject the deployments behind those scenes.
    const worldWatermarksCleared =
      served.length === 0
        ? 0
        : (
            await WorldUndeploymentModel.namedQuery(
              "repair_clear_world_undeployment",
              SQL`
                DELETE FROM ${table(WorldUndeploymentModel)}
                WHERE "world_id" = ${worldId}
                RETURNING "world_id"
              `
            )
          ).length

    // Scene watermarks that name a served deployment contradict the content server outright; the
    // rest are cleared only where they would reject the scene now serving that base parcel.
    const sceneWatermarksCleared =
      served.length === 0
        ? 0
        : (
            await WorldSceneUndeploymentModel.namedQuery(
              "repair_clear_scene_undeployments",
              SQL`
                DELETE FROM ${table(WorldSceneUndeploymentModel)} watermark
                USING unnest(
                  ${served.map((scene) => scene.base)}::text[],
                  ${served.map((scene) => scene.deployedAt)}::timestamp[]
                ) AS live("base_position", "deployed_at")
                WHERE watermark."world_id" = ${worldId}
                  AND (
                    watermark."deployment_id" = ANY(${served.map(
                      (scene) => scene.entityId
                    )}::text[])
                    OR (
                      watermark."base_position" = live."base_position"
                      AND watermark."undeployed_at" >= live."deployed_at"
                    )
                  )
                RETURNING watermark."deployment_id"
              `
            )
          ).length

    // Position watermarks are cleared only on parcels a served scene occupies, and only when they
    // are recent enough to reject that scene.
    const positionWatermarksCleared =
      served.length === 0
        ? 0
        : (
            await WorldDeploymentPositionWatermarkModel.namedQuery(
              "repair_clear_position_watermarks",
              SQL`
                DELETE FROM ${table(
                  WorldDeploymentPositionWatermarkModel
                )} watermark
                USING unnest(
                  ${served.flatMap((scene) => scene.parcels)}::text[],
                  ${served.flatMap((scene) =>
                    scene.parcels.map(() => scene.deployedAt)
                  )}::timestamp[]
                ) AS live("position", "deployed_at")
                WHERE watermark."world_id" = ${worldId}
                  AND watermark."position" = live."position"
                  AND watermark."superseded_at" >= live."deployed_at"
                RETURNING watermark."position"
              `
            )
          ).length

    const repair: WorldRepair = {
      reenabledByIdentity,
      reenabledByFootprint,
      ambiguous,
      stillGone,
      worldWatermarksCleared,
      sceneWatermarksCleared,
      positionWatermarksCleared,
    }

    if (dryRun) throw new DryRunRollback(repair)
    return repair
  }

  try {
    return await withDatabaseTransaction(run)
  } catch (error) {
    if (error instanceof DryRunRollback) return error.repair
    throw error
  }
}

// ── Reporting ──────────────────────────────────────────────────────────

function reportWorld(worldId: string, repair: WorldRepair, dryRun: boolean) {
  const prefix = dryRun ? "  [DRY-RUN] would" : "  "
  const reenabled =
    repair.reenabledByIdentity.length + repair.reenabledByFootprint.length

  if (reenabled === 0) {
    logger.log(
      `  Nothing to re-enable (${repair.stillGone} place(s) correctly disabled)`
    )
  }

  for (const place of repair.reenabledByIdentity) {
    logger.log(
      `${prefix} re-enable "${place.title}" at ${place.base_position} (deployment ${place.deployment_id})`
    )
  }
  for (const { place, scene } of repair.reenabledByFootprint) {
    logger.log(
      `${prefix} re-enable "${place.title}" at ${place.base_position} and backfill deployment ${scene.entityId}`
    )
  }
  for (const place of repair.ambiguous) {
    logger.log(
      `  NEEDS REVIEW: legacy place "${place.title}" at ${place.base_position} sits at a served base but its stored footprint does not match that scene; rebuild this world with bin/rebuildWorldPlaces.ts`
    )
  }

  const watermarks =
    repair.worldWatermarksCleared +
    repair.sceneWatermarksCleared +
    repair.positionWatermarksCleared
  if (watermarks > 0) {
    logger.log(
      `${prefix} clear ${watermarks} watermark row(s): ${repair.worldWatermarksCleared} world, ${repair.sceneWatermarksCleared} scene, ${repair.positionWatermarksCleared} position`
    )
  }
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  const { dryRun, limit, worldName, connectionString } = parseArgs()

  if (connectionString) {
    process.env.CONNECTION_STRING = connectionString
  }

  const worldsContentServerUrl = env(
    "WORLDS_CONTENT_SERVER_URL",
    "https://worlds-content-server.decentraland.org"
  ).replace(/\/+$/, "")

  logger.log("=".repeat(60))
  logger.log("Repair Undeployed World Places")
  logger.log("=".repeat(60))
  logger.log(`Worlds Content Server: ${worldsContentServerUrl}`)
  logger.log(`Mode: ${dryRun ? "DRY RUN (rolled back)" : "LIVE"}`)
  logger.log(`Limit: ${limit || "No limit"}`)
  logger.log(`World filter: ${worldName || "All affected worlds"}`)
  logger.log("=".repeat(60))

  if (!process.env.CONNECTION_STRING) {
    throw new Error(
      "CONNECTION_STRING environment variable is required (or use --connection-string)"
    )
  }

  await database.connect()
  logger.log("Database connected")

  const stats: Stats = {
    worlds: 0,
    reenabled: 0,
    backfilled: 0,
    ambiguous: 0,
    watermarksCleared: 0,
    errored: 0,
  }

  try {
    const worlds = await findAffectedWorlds(worldName, limit)
    logger.log(
      `Found ${worlds.length} world(s) with undeployment-disabled places`
    )
    logger.log("")

    for (let index = 0; index < worlds.length; index++) {
      const worldId = worlds[index]
      logger.log(`[${index + 1}/${worlds.length}] ${worldId}`)

      try {
        const served = await fetchServedScenes(worldsContentServerUrl, worldId)
        logger.log(`  Content server serves ${served.length} scene(s)`)

        const repair = await repairWorld(worldId, served, dryRun)
        reportWorld(worldId, repair, dryRun)

        stats.worlds++
        stats.reenabled +=
          repair.reenabledByIdentity.length + repair.reenabledByFootprint.length
        stats.backfilled += repair.reenabledByFootprint.length
        stats.ambiguous += repair.ambiguous.length
        stats.watermarksCleared +=
          repair.worldWatermarksCleared +
          repair.sceneWatermarksCleared +
          repair.positionWatermarksCleared
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`  Error repairing ${worldId}: ${message}`)
        stats.errored++
      }

      if (index < worlds.length - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, DELAY_BETWEEN_WORLDS_MS)
        )
      }
    }
  } finally {
    logger.log("")
    logger.log("=".repeat(60))
    logger.log(`Worlds processed:     ${stats.worlds}`)
    logger.log(`Places re-enabled:    ${stats.reenabled}`)
    logger.log(`Deployment ids added: ${stats.backfilled}`)
    logger.log(`Ambiguous legacy:     ${stats.ambiguous}`)
    logger.log(`Watermarks cleared:   ${stats.watermarksCleared}`)
    logger.log(`Errored worlds:       ${stats.errored}`)
    logger.log("=".repeat(60))

    if (dryRun) {
      logger.log("")
      logger.log("This was a dry run. Every transaction was rolled back.")
      logger.log("Run without --dry-run to apply changes.")
    }

    try {
      await database.close()
    } catch {
      // ignore close errors
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    logger.error("Script failed:", error)
    process.exit(1)
  })
}
