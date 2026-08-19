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
 * 2. Re-enables places whose deployment the world still serves, backfilling a deployment id onto a
 *    legacy row when exactly one served scene fits its footprint
 * 3. Reports what it cannot fix, rather than guessing
 *
 * Places whose scene is genuinely gone are left disabled.
 *
 * It writes nothing else. In particular it never relaxes a durable undeployment guard, even one it
 * can prove is now too aggressive -- a tombstone naming a deployment the world still serves, or a
 * watermark stamped with the emission time of the removal instead of the entity timestamp.
 *
 * That restraint is the point. Those guards are the only record of a removal that Places never held a
 * row for: an out-of-order deployment rejected on arrival leaves nothing behind, so nothing local
 * distinguishes it from a deployment Places has simply not seen yet. Relax the guard and a redelivery
 * of that deployment passes every check and recreates content the world does not serve, which is this
 * incident inverted and less visible. Leaving it costs only the ability to re-ingest content authored
 * before the incident, and every row this repair fixes is already correct without that.
 *
 * Reconstructing the missing tombstones needs an authority on what was removed. The worlds content
 * server has one -- it marks removed scenes status='UNDEPLOYED' and keeps the row until a garbage
 * collection window expires -- but does not expose it: GetWorldScenesFilters carries an
 * includeUndeployed flag that the HTTP handler never sets. Until it does, and for removals older than
 * that window, this repair cannot prove full coverage and so does not try.
 *
 * The one gap that leaves is a scene the world serves that no place row represents. It is reported per
 * world as NEEDS REBUILD: bin/rebuildWorldPlaces.ts writes place rows directly and never consults
 * these tables, so it fixes those without any guard being relaxed.
 *
 * Operational precondition: no deployment for these worlds may still be undelivered or redeliverable
 * from before the repair. A rejected deployment still disables active places it supersedes, so a
 * delayed delivery can re-disable a repaired place no matter what this script does or does not touch.
 * Drain the queues, or re-run the repair afterwards.
 *
 * The served-scene read happens under the world's deployment lock, so it is bounded end to end: a
 * world whose listing cannot be read within the deadline is failed and skipped, releasing the lock,
 * rather than blocking that world's deployments.
 *
 * Must run with TZ=UTC. Backfilling a legacy row writes the served entity's timestamp into
 * places.deployed_at, node-postgres renders a Date in the process timezone, and `timestamp` columns
 * carry no offset -- so a run from any other zone stores a value shifted by that offset, and every
 * later guard that compares deployed_at silently judges that place by the wrong instant. The script
 * refuses to start otherwise.
 *
 * Usage:
 *   TZ=UTC DOTENV_CONFIG_PATH=.env.development ts-node -r dotenv/config bin/repairUndeployedWorldPlaces.ts [options]
 *   TZ=UTC DOTENV_CONFIG_PATH=.env.production ts-node -r dotenv/config bin/repairUndeployedWorldPlaces.ts [options]
 *
 * Options:
 *   --apply                  Commit the repair. Without it the run is a dry run and rolls back.
 *   --dry-run                Ask for a dry run explicitly, which is also the default
 *   --limit N                Repair at most N worlds
 *   --world-name NAME        Repair only a specific world
 *   --connection-string URL  Override the CONNECTION_STRING environment variable
 *
 * Examples:
 *   TZ=UTC DOTENV_CONFIG_PATH=.env.production ts-node -r dotenv/config bin/repairUndeployedWorldPlaces.ts
 *   TZ=UTC DOTENV_CONFIG_PATH=.env.production ts-node -r dotenv/config bin/repairUndeployedWorldPlaces.ts --apply --world-name "cyaiox.dcl.eth"
 */

import database from "decentraland-gatsby/dist/entities/Database/database"
import { SQL, table } from "decentraland-gatsby/dist/entities/Database/utils"
import logger from "decentraland-gatsby/dist/entities/Development/logger"
import env from "decentraland-gatsby/dist/utils/env"

import { ScriptArgs, parseScriptArgs } from "./scriptArgs"
import { withDatabaseTransaction } from "../src/entities/Database/model"
import PlaceModel from "../src/entities/Place/model"
import { DisabledReason } from "../src/entities/Place/types"
import WorldModel from "../src/entities/World/model"
import { drainResponse } from "../src/utils/fetch"

// ── Types ──────────────────────────────────────────────────────────────

/** A scene the worlds content server serves right now. */
export type ServedScene = {
  entityId: string
  base: string
  parcels: string[]
  /**
   * The entity timestamp as a Date, which is how every writer of these watermarks supplies one.
   * node-postgres renders a Date in the process timezone and `::timestamp` discards the offset, so
   * the stored values carry that same convention; comparing against anything else -- an ISO string
   * in UTC, say -- only agrees when the process happens to be UTC.
   */
  deployedAt: Date
}

type DisabledPlace = {
  id: string
  title: string | null
  base_position: string
  positions: string[]
  deployment_id: string | null
  /** As the pg parser returns it; passed straight back so its value is never re-serialized. */
  deployed_at: Date | string
}

export type WorldRepair = {
  reenabledByIdentity: DisabledPlace[]
  reenabledByFootprint: Array<{ place: DisabledPlace; scene: ServedScene }>
  ambiguous: DisabledPlace[]
  alreadyRepresented: DisabledPlace[]
  baseSquatted: DisabledPlace[]
  stillGone: number
  /**
   * Scenes the world serves that no enabled or re-enabled place represents. The repair cannot create
   * these -- it only ever re-enables a row that already exists -- and the durable guards it leaves
   * standing will reject a redelivery of their deployment, so they need bin/rebuildWorldPlaces.ts.
   */
  servedWithoutPlace: ServedScene[]
}

type Stats = {
  worlds: number
  reenabled: number
  backfilled: number
  ambiguous: number
  alreadyRepresented: number
  baseSquatted: number
  servedWithoutPlace: number
  errored: number
}

// ── Constants ──────────────────────────────────────────────────────────

/** Worlds Content Server caps and defaults its scene pages at 100 rows. */
const SCENES_PAGE_SIZE = 100
/** Per request, matching the service's own reader. */
const SCENES_FETCH_TIMEOUT_MS = 15_000
/**
 * The whole read, not just one request. It happens under the per-world lock, which is what makes an
 * unbounded read dangerous: a hung page would hold the lock and block that world's deployments and
 * undeployments until the process died. Bounded end to end so the world fails and releases instead.
 */
const SERVED_SCENES_DEADLINE_MS = 60_000
/** How many times to re-read a multi-page listing looking for two that agree. */
const STABLE_READ_ATTEMPTS = 3
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

function parseArgs(): ScriptArgs {
  return parseScriptArgs(process.argv.slice(2))
}

// ── Content server ─────────────────────────────────────────────────────

/**
 * Read every scene a world serves. The listing is paginated and a short read would look like a
 * smaller world, which is the mistake this repair exists to undo, so the rows served are reconciled
 * against the reported total and anything short throws.
 */
export async function fetchServedScenes(
  baseUrl: string,
  worldName: string
): Promise<ServedScene[]> {
  const deadline = Date.now() + SERVED_SCENES_DEADLINE_MS
  let read = await readScenePages(baseUrl, worldName, deadline)

  // One page is one query upstream, so it is already a consistent snapshot. More than one is paged by
  // offset over a listing ordered without a tiebreaker, where a removal before the next offset and an
  // addition after the end keep the total unchanged, repeat nothing, and still hide a live scene. The
  // checks inside readScenePages cannot see that, so agreement between two whole reads is what stands
  // in for the snapshot the server does not offer. Every world today is a single page.
  if (read.pages <= 1) return read.scenes

  for (let attempt = 2; attempt <= STABLE_READ_ATTEMPTS; attempt++) {
    const again = await readScenePages(baseUrl, worldName, deadline)
    if (fingerprintScenes(read.scenes) === fingerprintScenes(again.scenes)) {
      return again.scenes
    }
    read = again
  }

  throw new Error(
    `Could not read a stable scene listing for ${worldName} across ${STABLE_READ_ATTEMPTS} attempts; skipping this world rather than acting on a torn reading`
  )
}

/** Order-independent identity of a whole listing, for comparing two reads of it. */
function fingerprintScenes(scenes: ServedScene[]): string {
  return scenes
    .map(
      (scene) =>
        `${scene.entityId}|${scene.base}|${[...scene.parcels]
          .sort()
          .join(",")}|${scene.deployedAt.getTime()}`
    )
    .sort()
    .join(";")
}

async function readScenePages(
  baseUrl: string,
  worldName: string,
  deadline: number
): Promise<{ scenes: ServedScene[]; pages: number }> {
  const scenes: ServedScene[] = []
  let total: number | null = null

  let pages = 0

  for (let page = 0; page < SCENES_MAX_PAGES; page++) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      throw new Error(
        `Timed out reading the scenes of ${worldName} after ${
          SERVED_SCENES_DEADLINE_MS / 1000
        }s; skipping this world rather than holding its lock`
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

    const body = await response.json()
    if (!body || !Array.isArray(body.scenes)) {
      throw new Error(`Unexpected scenes response for ${worldName}`)
    }
    // The listing is ordered by creation with no tiebreaker and paged by offset, so a scene removed
    // mid-read slides rows past the offset unseen. A total that disagrees with the first page's is
    // that shift; without a total there is nothing to check the read against at all.
    if (typeof body.total !== "number" || body.total < 0) {
      throw new Error(
        `Scenes response for ${worldName} does not report how many scenes it has`
      )
    }
    if (total === null) {
      total = body.total
    } else if (body.total !== total) {
      throw new Error(
        `Scenes for ${worldName} changed while being read: ${total} scenes, then ${body.total}`
      )
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

    pages++

    if (body.scenes.length < SCENES_PAGE_SIZE) break
    if (total !== null && scenes.length >= total) break
  }

  if (scenes.length !== total) {
    throw new Error(
      `Content server served ${scenes.length} of ${total} scenes for ${worldName}`
    )
  }

  // Deployment ids are unique per world upstream, so a duplicate means a page repeated a scene in
  // place of one it skipped.
  if (new Set(scenes.map((scene) => scene.entityId)).size !== scenes.length) {
    throw new Error(
      `Content server repeated a scene while serving ${worldName}; the listing shifted mid-read`
    )
  }

  return { scenes, pages }
}

// ── Queries ────────────────────────────────────────────────────────────

export async function findAffectedWorlds(
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
      SELECT "id", "title", "base_position", "positions", "deployment_id", "deployed_at"
      FROM ${table(PlaceModel)}
      WHERE "world" IS TRUE
        AND "world_id" = ${worldId}
        AND "disabled" IS TRUE
        AND "disabled_reason" = ${DisabledReason.UNDEPLOYMENT}
    `
  )
}

/**
 * The places this world already shows. Their scenes and base parcels are off limits: re-enabling a
 * second row for either leaves two active places the base fallback can never disable again.
 */
async function findEnabledPlaces(
  worldId: string
): Promise<Array<{ deployment_id: string | null; base_position: string }>> {
  return PlaceModel.namedQuery<{
    deployment_id: string | null
    base_position: string
  }>(
    "repair_find_enabled_places",
    SQL`
      SELECT "deployment_id", "base_position"
      FROM ${table(PlaceModel)}
      WHERE "world" IS TRUE
        AND "world_id" = ${worldId}
        AND "disabled" IS FALSE
    `
  )
}

function sameFootprint(left: string[], right: string[]): boolean {
  const seen = new Set(left)
  const other = new Set(right)
  if (seen.size !== other.size) return false
  return [...other].every((parcel) => seen.has(parcel))
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
export async function repairWorld(
  rawWorldId: string,
  fetchServed: () => Promise<ServedScene[]>,
  dryRun: boolean
): Promise<WorldRepair> {
  // world_id is stored lower-cased. This is exported, so a mixed-case argument would otherwise match
  // nothing at all and report a clean world.
  const worldId = rawWorldId.toLowerCase()

  const run = async (): Promise<WorldRepair> => {
    // Same lock every ingestion path takes, and the served set is read inside it.
    //
    // The lock alone gives mutual exclusion, not freshness: read the served set before it and a
    // genuine undeployment can commit while the lock is being waited on, after which this would
    // re-enable a place whose scene really is gone and delete the tombstone and watermarks that
    // removal just wrote, with no message left to redeliver them. Detecting that after the fact is
    // not possible either -- a removal for an already-disabled place writes durable records without
    // touching any place row, so there is nothing local to notice.
    //
    // The service cannot hold this lock across an HTTP call because it would stall deployments for
    // that world. A one-off operator repair has no such constraint: one world at a time, for the
    // length of one request.
    await WorldModel.lockWorldForDeployment(worldId)

    const served = await fetchServed()
    const now = new Date()
    const places = await findDisabledPlaces(worldId)
    const servedIds = new Set(served.map((scene) => scene.entityId))

    const reenabledByIdentity: DisabledPlace[] = []
    const reenabledByFootprint: Array<{
      place: DisabledPlace
      scene: ServedScene
    }> = []
    const ambiguous: DisabledPlace[] = []
    const alreadyRepresented: DisabledPlace[] = []
    const baseSquatted: DisabledPlace[] = []
    const stillGonePlaces: DisabledPlace[] = []

    // A scene whose place row was disabled by this bug gets a brand new row from the ingestion path
    // and from bin/rebuildWorldPlaces.ts, because neither looks at rows disabled as undeployments.
    // Re-enabling the old row on top of that leaves two enabled places carrying one deployment id at
    // one base, which then permanently blocks the base fallback that needs a single active row. So
    // whatever is already enabled claims its scene and its base before anything is re-enabled.
    const enabled = await findEnabledPlaces(worldId)
    const claimed = new Set(
      enabled
        .map((place) => place.deployment_id)
        .filter((id): id is string => !!id)
    )
    const basesTaken = new Set(enabled.map((place) => place.base_position))
    const legacy: DisabledPlace[] = []

    for (const place of places) {
      if (!place.deployment_id) {
        legacy.push(place)
        continue
      }
      if (!servedIds.has(place.deployment_id)) {
        stillGonePlaces.push(place)
      } else if (claimed.has(place.deployment_id)) {
        alreadyRepresented.push(place)
      } else if (basesTaken.has(place.base_position)) {
        // Its scene is served, but another enabled row holds the base and that row's deployment is
        // not what the world serves. Re-enabling would put two active places on one parcel, so this
        // needs the stale row cleared first rather than a reassuring line in the report.
        baseSquatted.push(place)
      } else {
        reenabledByIdentity.push(place)
        claimed.add(place.deployment_id)
        basesTaken.add(place.base_position)
      }
    }

    for (const place of legacy) {
      if (basesTaken.has(place.base_position)) {
        baseSquatted.push(place)
        continue
      }

      const exact = served.filter(
        (scene) =>
          !claimed.has(scene.entityId) &&
          scene.base === place.base_position &&
          sameFootprint(scene.parcels, place.positions)
      )
      if (exact.length === 1) {
        reenabledByFootprint.push({ place, scene: exact[0] })
        claimed.add(exact[0].entityId)
        basesTaken.add(place.base_position)
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
        stillGonePlaces.push(place)
      }
    }

    if (reenabledByIdentity.length > 0) {
      const updated = await PlaceModel.namedRowCount(
        "repair_reenable_by_identity",
        SQL`
          UPDATE ${table(PlaceModel)}
          SET "disabled" = FALSE,
            "disabled_at" = NULL,
            "disabled_reason" = NULL,
            "updated_at" = ${now}
          WHERE "id" = ANY(${reenabledByIdentity.map(
            (place) => place.id
          )}::bpchar[])
            AND "world_id" = ${worldId}
            AND "disabled" IS TRUE
            AND "disabled_reason" = ${DisabledReason.UNDEPLOYMENT}
        `
      )

      if (updated !== reenabledByIdentity.length) {
        throw new Error(
          `Expected to re-enable ${reenabledByIdentity.length} place(s) by identity in ${worldId} but matched ${updated}; refusing to touch this world's watermarks`
        )
      }
    }

    if (reenabledByFootprint.length > 0) {
      const updated = await PlaceModel.namedRowCount(
        "repair_reenable_by_footprint",
        SQL`
          UPDATE ${table(PlaceModel)} target
          SET "disabled" = FALSE,
            "disabled_at" = NULL,
            "disabled_reason" = NULL,
            "deployment_id" = matched."deployment_id",
            -- without its timestamp the row advertises a deployment newer than itself, and every
            -- later guard comparing deployed_at would judge the live deployment as older than it is
            "deployed_at" = matched."deployed_at",
            "updated_at" = ${now}
          FROM unnest(
            ${reenabledByFootprint.map(({ place }) => place.id)}::bpchar[],
            ${reenabledByFootprint.map(({ scene }) => scene.entityId)}::text[],
            ${reenabledByFootprint.map(
              ({ scene }) => scene.deployedAt
            )}::timestamp[]
          ) AS matched("id", "deployment_id", "deployed_at")
          WHERE target."id" = matched."id"
            AND target."world_id" = ${worldId}
            -- only ever backfills a row that has no identity of its own, which also makes a
            -- NULL-padded unnest incapable of stripping one
            AND target."deployment_id" IS NULL
            AND target."disabled" IS TRUE
            AND target."disabled_reason" = ${DisabledReason.UNDEPLOYMENT}
        `
      )

      if (updated !== reenabledByFootprint.length) {
        throw new Error(
          `Expected to re-enable ${reenabledByFootprint.length} legacy place(s) in ${worldId} but matched ${updated}; refusing to touch this world's watermarks`
        )
      }
    }

    // Every durable guard this world carries is left exactly as it stands, including the ones that
    // are now demonstrably too aggressive: a tombstone naming a deployment the world still serves,
    // and watermarks stamped with the emission time of the removal.
    //
    // They are wrong, but they are wrong in the safe direction. All three tables have one reader,
    // resolveWorldDeployment, and it reads them only to reject an incoming deployment -- none of them
    // can hold a place row disabled. So an over-aggressive guard costs nothing except the ability to
    // re-ingest content authored before the incident, and the rows this repair fixes are already
    // correct without that.
    //
    // Relaxing one, on the other hand, cannot be done safely. A full-world or position watermark is
    // the only record of a removal that Places never held a row for -- an out-of-order deployment
    // rejected on arrival leaves nothing behind. Lower it and a redelivery of that deployment passes
    // every guard and recreates a scene the world does not serve, which is this incident inverted.
    // Nothing local distinguishes that deployment from one Places has simply not seen yet, and a
    // per-place tombstone can only be synthesized for removals that did leave a row.
    //
    // Which leaves one real gap: a scene the world serves that no place row represents. That is the
    // only thing lowering a watermark would have bought, and it does not need a watermark -- see
    // servedWithoutPlace below and bin/rebuildWorldPlaces.ts, which writes rows directly and never
    // consults these tables.
    const servedWithoutPlace = served.filter(
      (scene) => !claimed.has(scene.entityId)
    )

    const repair: WorldRepair = {
      reenabledByIdentity,
      reenabledByFootprint,
      ambiguous,
      alreadyRepresented,
      baseSquatted,
      stillGone: stillGonePlaces.length,
      servedWithoutPlace,
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

  for (const place of repair.alreadyRepresented) {
    logger.log(
      `  ALREADY REPRESENTED: "${place.title}" at ${place.base_position} is covered by an enabled place holding the same deployment; nothing to do`
    )
  }

  for (const place of repair.baseSquatted) {
    logger.log(
      `  NEEDS REVIEW: "${place.title}" at ${place.base_position} matches a served scene, but an enabled place holds that base with a deployment the world does not serve. The world still shows stale content; rebuild it with bin/rebuildWorldPlaces.ts, then re-run this.`
    )
  }

  for (const scene of repair.servedWithoutPlace) {
    logger.log(
      `  NEEDS REBUILD: the world serves ${scene.entityId} at ${scene.base} and no place row represents it. This repair only re-enables rows that exist, and the undeployment watermarks it leaves standing will reject a redelivery of that deployment; rebuild this world with bin/rebuildWorldPlaces.ts.`
    )
  }
}

// ── Main ───────────────────────────────────────────────────────────────

async function main(): Promise<number> {
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

  // The service writes these timestamps from a UTC process and the columns carry no offset, so a
  // repair run from another zone compares local wall clock against UTC wall clock and deletes the
  // wrong rows without any error. No test can catch this: a test's fixtures and the code under test
  // always share the process timezone.
  if (new Date().getTimezoneOffset() !== 0) {
    throw new Error(
      `Refusing to run outside UTC: this process is offset by ${
        -new Date().getTimezoneOffset() / 60
      }h, which would shift every timestamp comparison. Re-run with TZ=UTC.`
    )
  }

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
    alreadyRepresented: 0,
    baseSquatted: 0,
    servedWithoutPlace: 0,
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
        // Fetched inside repairWorld, under the per-world lock, so it cannot describe a world that
        // has already moved on.
        const repair = await repairWorld(
          worldId,
          async () => {
            const served = await fetchServedScenes(
              worldsContentServerUrl,
              worldId
            )
            logger.log(`  Content server serves ${served.length} scene(s)`)
            return served
          },
          dryRun
        )

        reportWorld(worldId, repair, dryRun)

        stats.worlds++
        stats.reenabled +=
          repair.reenabledByIdentity.length + repair.reenabledByFootprint.length
        stats.backfilled += repair.reenabledByFootprint.length
        stats.ambiguous += repair.ambiguous.length
        stats.alreadyRepresented += repair.alreadyRepresented.length
        stats.baseSquatted += repair.baseSquatted.length
        stats.servedWithoutPlace += repair.servedWithoutPlace.length
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
    logger.log(`Already represented:  ${stats.alreadyRepresented}`)
    logger.log(`Base squatted:        ${stats.baseSquatted}`)
    logger.log(`Served, no place row: ${stats.servedWithoutPlace}`)
    logger.log(`Errored worlds:       ${stats.errored}`)
    logger.log("=".repeat(60))

    if (dryRun) {
      logger.log("")
      logger.log("This was a dry run. Every transaction was rolled back.")
      logger.log("Re-run with --apply to commit these changes.")
    }

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
      // A world the repair could not read or write is the case an operator most needs to notice, so
      // it must not look like a clean run.
      if (errored > 0) process.exit(1)
    })
    .catch((error) => {
      logger.error("Script failed:", error)
      process.exit(1)
    })
}
