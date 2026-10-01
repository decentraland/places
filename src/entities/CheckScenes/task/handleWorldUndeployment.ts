import { WorldUndeploymentEvent } from "@dcl/schemas/dist/platform/events/world"
import logger from "decentraland-gatsby/dist/entities/Development/logger"

import { fetchWorldActiveScenes } from "./fetchWorldActiveScenes"
import { withDatabaseTransaction } from "../../Database/model"
import PlaceModel from "../../Place/model"
import { notifyError } from "../../Slack/utils"
import WorldModel from "../../World/model"
import WorldUndeploymentModel from "../../WorldUndeployment/model"

/** How many times to re-read before giving up on a world that keeps changing underneath. */
const SNAPSHOT_ATTEMPTS = 3

/**
 * Whether two readings of a world's enabled places describe the same rows at the same revisions.
 * The deployment id is compared as well as the row id, because a replacement reuses the row it
 * replaces.
 */
function sameRevisions(
  left: Array<{ id: string; deployment_id: string | null }>,
  right: Array<{ id: string; deployment_id: string | null }>
): boolean {
  if (left.length !== right.length) return false
  const seen = new Set(
    left.map((place) => `${place.id}|${place.deployment_id}`)
  )
  return right.every((place) => seen.has(`${place.id}|${place.deployment_id}`))
}

/**
 * Handles WorldUndeploymentEvent from the worlds content server.
 * Disables the place records of the undeployed world. The world entity itself is not
 * modified -- it simply won't appear in queries once it has no enabled places.
 *
 * The event names no scenes and is stamped with the moment the worlds content server emitted it.
 * The full-world watermark is compared against a deployment's emission time on that same clock, so
 * it retires everything the world held before the removal and none of the scenes deployed after it,
 * however long before it they were signed. It is recorded whether or not the world still serves
 * scenes.
 *
 * The place rows only carry entity timestamps, though, so a scene deployed after the removal but
 * signed before it would look older than the event. What the world still serves is therefore read
 * from the content server and left enabled.
 */
export async function handleWorldUndeployment(
  event: WorldUndeploymentEvent
): Promise<void> {
  const worldName = event.metadata.worldName

  if (!worldName) {
    logger.error("WorldUndeploymentEvent missing world name")
    return
  }

  const loggerExtended = logger.extend({
    worldName,
    eventType: "WorldUndeploymentEvent",
  })

  try {
    loggerExtended.log(`Processing world undeployment for world: ${worldName}`)

    for (let attempt = 1; ; attempt++) {
      // Read before the survivor set so both describe the same moment.
      const snapshot = await PlaceModel.findWorldPlaceSnapshot(worldName)
      const activeScenes = await fetchWorldActiveScenes(worldName)
      const isTornDown = activeScenes.deploymentIds.length === 0

      // Same lock the deployment path takes, so an in-flight deployment for this world cannot
      // commit an enabled place this event would have disabled
      const applied = await withDatabaseTransaction(async () => {
        await WorldModel.lockWorldForDeployment(worldName)

        // The survivor set was read before the lock, so a deployment for this world may have
        // committed while the lock was being waited on. Neither way of acting on a stale reading is
        // acceptable: judging by it can disable a scene the world serves, and skipping what it does
        // not describe leaves content the world dropped enabled with no record of the removal, since
        // this event names nothing a later event could match. Start over instead -- the reading is
        // two cheap statements and a listing, and the window is the lock wait.
        if (
          !sameRevisions(
            await PlaceModel.findEnabledWorldPlaceRevisions(worldName),
            snapshot.revisions
          )
        ) {
          return null
        }

        // Durable watermark: a deployment delivered later but emitted before this event must not
        // recreate the world, and disabling rows alone leaves no record once the lock is released
        await WorldUndeploymentModel.recordWatermark(worldName, event.timestamp)

        const disabled = await PlaceModel.disableByWorldId(
          worldName,
          event.timestamp,
          activeScenes.deploymentIds,
          activeScenes.positions
        )

        return {
          disabled,
          isTornDown,
          served: activeScenes.deploymentIds.length,
        }
      })

      if (applied) {
        loggerExtended.log(
          applied.isTornDown
            ? `Disabled all ${applied.disabled.length} place records for world: ${worldName}`
            : `Disabled ${applied.disabled.length} place records for reshaped world: ${worldName}, which still serves ${applied.served} scenes`
        )
        return
      }

      if (attempt >= SNAPSHOT_ATTEMPTS) {
        throw new Error(
          `Places for ${worldName} kept changing while its served scenes were read; giving up after ${SNAPSHOT_ATTEMPTS} attempts`
        )
      }

      loggerExtended.log(
        `WARNING: places for ${worldName} changed while its served scenes were read; retrying (attempt ${attempt} of ${SNAPSHOT_ATTEMPTS})`
      )
    }
  } catch (error: any) {
    loggerExtended.error(
      `Error handling WorldUndeploymentEvent for ${worldName}: ${error.message}`
    )
    notifyError([
      `Error handling WorldUndeploymentEvent`,
      `World: ${worldName}`,
      error.message,
    ])
    throw error
  }
}
