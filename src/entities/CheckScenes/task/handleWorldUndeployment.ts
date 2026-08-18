import { WorldUndeploymentEvent } from "@dcl/schemas/dist/platform/events/world"
import logger from "decentraland-gatsby/dist/entities/Development/logger"

import { fetchWorldActiveScenes } from "./fetchWorldActiveScenes"
import { withDatabaseTransaction } from "../../Database/model"
import PlaceModel from "../../Place/model"
import { notifyError } from "../../Slack/utils"
import WorldModel from "../../World/model"
import WorldDeploymentPositionWatermarkModel from "../../WorldDeploymentPositionWatermark/model"
import WorldSceneUndeploymentModel from "../../WorldSceneUndeployment/model"
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
 * The event names no scenes and is stamped with the moment the removal was emitted, which is
 * always later than the entity timestamp of a deployment that replaced the world's scene set.
 * A world that still serves scenes was therefore reshaped rather than torn down, so what it
 * still serves is read from the content server and left alone, and no full-world watermark is
 * recorded: that watermark would reject every later delivery of those surviving deployments.
 *
 * Skipping it would cost the out-of-order protection for every scene this statement does not
 * disable -- rows already disabled, and scenes whose deployment has not arrived -- so the parcels
 * the world is known to have held are watermarked instead. What remains uncovered is a scene on
 * parcels no place row ever recorded, which nothing local can describe. A stale enabled place there
 * is the lesser failure and bin/rebuildWorldPlaces.ts reconciles it; recording the full-world
 * watermark instead rejects the surviving deployments outright and leaves the world invisible.
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
      const livePositions = new Set(activeScenes.positions)

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

        // Durable watermark: a deployment delivered later but produced before this event must not
        // recreate the world, and disabling rows alone leaves no record once the lock is released
        if (isTornDown) {
          await WorldUndeploymentModel.recordWatermark(
            worldName,
            event.timestamp
          )
        }

        const disabled = await PlaceModel.disableByWorldId(
          worldName,
          event.timestamp,
          activeScenes.deploymentIds,
          activeScenes.positions
        )

        // A reshaped world gets the same durable record per removed scene, so a later delivery of one
        // of those deployments cannot recreate the place without blocking the surviving ones
        if (!isTornDown) {
          await WorldSceneUndeploymentModel.recordScenes(
            worldName,
            disabled.map((place) => ({
              // Legacy rows predate deployment ids. Their stable local id gives the watermark a
              // unique key while base-position matching still protects older deployments for that
              // scene.
              entityId: place.deployment_id || `legacy-place:${place.id}`,
              baseParcel: place.base_position,
              // Passed through rather than reconstructed: the pg parser reads a timestamp column as
              // an ISO string, and turning it back into a Date would re-serialize it in the process
              // timezone and shift the value.
              undeployedAt: place.deployed_at,
              // A base a survivor still occupies must not reject, or this row rejects the deployment
              // serving it; the row remains an identity tombstone for what was removed.
              basePositionRejects: !livePositions.has(place.base_position),
            }))
          )

          // Identity only covers the rows this statement disabled, which leaves out every row that
          // was already disabled and every scene whose deployment has not arrived. Watermark the
          // parcels instead: anything the snapshot recorded for this world that nothing now serves
          // was cleared by this event, and a parcel with nothing serving it cannot veto a survivor.
          await WorldDeploymentPositionWatermarkModel.recordPositions(
            worldName,
            snapshot.positions.filter(
              (position) => !livePositions.has(position)
            ),
            new Date(event.timestamp),
            true
          )
        }

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
