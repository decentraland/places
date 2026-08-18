import env from "decentraland-gatsby/dist/utils/env"

import { getTrustedWorldsContentServerUrl } from "./processEntityId"
import { drainResponse } from "../../../utils/fetch"

const WORLD_SCENES_FETCH_TIMEOUT_MS = 15_000
/** Worlds Content Server caps and defaults its scene pages at 100 rows. */
const WORLD_SCENES_PAGE_SIZE = 100
/** Backstop against a total that never agrees with the rows served. */
const WORLD_SCENES_MAX_PAGES = 200
/** Worlds Content Server rejects coordinate queries longer than this. */
const MAX_COORDINATES_PER_REQUEST = 500
const PARCEL_PATTERN = /^(?:0|-?[1-9][0-9]*),(?:0|-?[1-9][0-9]*)$/

/**
 * The scenes a world serves upstream right now.
 */
export type WorldActiveScenes = {
  /** Deployment ids the world still serves. */
  deploymentIds: string[]
  /** Every parcel those deployments cover. */
  positions: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

/**
 * Read every scene a world serves.
 *
 * A full-world undeployment names no scenes, so nothing bounds which of the world's places it would
 * disable and every survivor has to be known to be spared. Reserved for that event: the scene
 * listing is paginated, and reading a whole world costs one request per hundred scenes.
 */
export async function fetchWorldActiveScenes(
  worldName: string,
  worldsContentServerUrl = env(
    "WORLDS_CONTENT_SERVER_URL",
    "https://worlds-content-server.decentraland.org"
  ),
  allowedContentServerHosts = env("ALLOWED_CONTENT_SERVER_HOSTS", "")
): Promise<WorldActiveScenes> {
  const contentServerUrl = getTrustedWorldsContentServerUrl(
    worldsContentServerUrl,
    allowedContentServerHosts
  )
  return collectScenes(contentServerUrl, worldName)
}

/**
 * Read the scenes a world serves at the given parcels.
 *
 * A scene undeployment disables places by the event's deployment ids, by overlap with its footprint
 * and by its base parcels, so every row it can reach occupies one of those parcels. Asking only
 * about them keeps the request bounded by the event rather than by the size of the world.
 *
 * A legacy place row extending beyond the footprint is therefore judged only on the parcels the
 * event covers. A surviving scene outside that footprint means the row was already replaced there,
 * so disabling it is the correct outcome rather than a missed exclusion.
 */
export async function fetchWorldActiveScenesAtPositions(
  worldName: string,
  positions: string[],
  worldsContentServerUrl = env(
    "WORLDS_CONTENT_SERVER_URL",
    "https://worlds-content-server.decentraland.org"
  ),
  allowedContentServerHosts = env("ALLOWED_CONTENT_SERVER_HOSTS", "")
): Promise<WorldActiveScenes> {
  const contentServerUrl = getTrustedWorldsContentServerUrl(
    worldsContentServerUrl,
    allowedContentServerHosts
  )

  const coordinates = [...new Set(positions)]
  if (coordinates.length === 0) {
    return { deploymentIds: [], positions: [] }
  }

  const deploymentIds = new Set<string>()
  const covered = new Set<string>()

  for (const batch of chunk(coordinates, MAX_COORDINATES_PER_REQUEST)) {
    const active = await collectScenes(contentServerUrl, worldName, batch)
    active.deploymentIds.forEach((id) => deploymentIds.add(id))
    active.positions.forEach((position) => covered.add(position))
  }

  return { deploymentIds: [...deploymentIds], positions: [...covered] }
}

/**
 * Page through a scene listing and prove the read was complete before returning it.
 *
 * A partial answer is indistinguishable from a smaller world, and acting on one is the mistake this
 * lookup exists to prevent, so every way a read can come up short throws instead. The listing is
 * ordered by creation with no tiebreaker and paged by offset, so a scene removed while the pages are
 * being read shifts the window and slides rows past the offset unseen -- which is exactly what a
 * world being torn down or reshaped is doing. Three things are therefore checked: the total never
 * changes between pages, the rows served add up to it, and no scene was served twice in place of one
 * that was missed.
 */
async function collectScenes(
  contentServerUrl: string,
  worldName: string,
  coordinates?: string[]
): Promise<WorldActiveScenes> {
  const deploymentIds = new Set<string>()
  const positions = new Set<string>()
  let received = 0
  let expected: number | null = null
  let complete = false

  for (let page = 0; page < WORLD_SCENES_MAX_PAGES; page++) {
    const scenes = await fetchWorldScenesPage(
      contentServerUrl,
      worldName,
      received,
      coordinates
    )

    if (expected === null) {
      expected = scenes.total
    } else if (scenes.total !== expected) {
      throw new Error(
        `Active scenes for ${worldName} changed while being read: ${expected} scenes, then ${scenes.total}`
      )
    }

    for (const scene of scenes.rows) {
      deploymentIds.add(scene.entityId)
      for (const parcel of scene.parcels) {
        positions.add(parcel)
      }
    }
    received += scenes.rows.length

    if (received >= expected) {
      complete = true
      break
    }
    // A page shorter than the limit before the total is reached means the listing shrank underneath
    // the read; stop and let the reconciliation below report it.
    if (scenes.rows.length < WORLD_SCENES_PAGE_SIZE) {
      break
    }
  }

  if (!complete) {
    throw new Error(
      `Active scenes response for ${worldName} served ${received} of ${
        expected ?? "unknown"
      } scenes`
    )
  }

  if (received !== expected) {
    throw new Error(
      `Active scenes response for ${worldName} served ${received} of ${expected} scenes`
    )
  }

  // Deployment ids are unique per world upstream, so a duplicate means a page repeated a scene in
  // place of one it skipped.
  if (deploymentIds.size !== received) {
    throw new Error(
      `Active scenes response for ${worldName} repeated ${
        received - deploymentIds.size
      } of ${received} scenes`
    )
  }

  return { deploymentIds: [...deploymentIds], positions: [...positions] }
}

type WorldScenesPage = {
  rows: Array<{ entityId: string; parcels: string[] }>
  total: number
}

async function fetchWorldScenesPage(
  contentServerUrl: string,
  worldName: string,
  offset: number,
  coordinates?: string[]
): Promise<WorldScenesPage> {
  const url = `${contentServerUrl}/world/${encodeURIComponent(
    worldName
  )}/scenes?limit=${WORLD_SCENES_PAGE_SIZE}&offset=${offset}`
  const response = await fetch(url, {
    signal: AbortSignal.timeout(WORLD_SCENES_FETCH_TIMEOUT_MS),
    ...(coordinates
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coordinates }),
        }
      : {}),
  })

  if (!response.ok) {
    await drainResponse(response)
    throw new Error(
      `Unable to fetch the active scenes of ${worldName}: ${response.status} ${response.statusText}`
    )
  }

  const body = await response.json()

  if (!isRecord(body) || !Array.isArray(body.scenes)) {
    throw new Error(
      `Active scenes response for ${worldName} does not contain a scene list`
    )
  }

  // The content server always reports a total. Without it there is nothing to prove the read was
  // complete, and an unproven read must not be mistaken for a world that serves less.
  if (typeof body.total !== "number" || body.total < 0) {
    throw new Error(
      `Active scenes response for ${worldName} does not report how many scenes it has`
    )
  }

  const rows = body.scenes.map((scene) => {
    if (
      !isRecord(scene) ||
      typeof scene.entityId !== "string" ||
      !scene.entityId
    ) {
      throw new Error(
        `Active scenes response for ${worldName} contains a scene without a deployment id`
      )
    }

    // Parcels are what protects legacy place rows, which carry no deployment id to match on, so an
    // unusable footprint is a failure rather than a scene to skip.
    if (
      !Array.isArray(scene.parcels) ||
      scene.parcels.length === 0 ||
      !scene.parcels.every(
        (parcel) => typeof parcel === "string" && PARCEL_PATTERN.test(parcel)
      )
    ) {
      throw new Error(
        `Active scenes response for ${worldName} contains scene '${scene.entityId}' without a usable footprint`
      )
    }

    return { entityId: scene.entityId, parcels: scene.parcels as string[] }
  })

  return { rows, total: body.total }
}
