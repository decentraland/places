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

/**
 * Handles WorldUndeploymentEvent from the worlds content server.
 * Disables the place records of the undeployed world. The world entity itself is not
 * modified -- it simply won't appear in queries once it has no enabled places.
 *
 * The event names no scenes and is stamped with the moment the removal was emitted, which is
 * always later than the entity timestamp of a deployment that replaced the world's scene set.
 * A world that still serves scenes was therefore reshaped rather than torn down, so what it
 * still serves is read from the content server and left alone. Its full-world watermark cannot
 * carry the event's own timestamp either, since that rejects the surviving deployments, so it is
 * placed just below the oldest survivor instead: low enough to accept every one of them, high
 * enough to retire everything older, which in a reshape is the whole removed set.
 *
 * Two things stay uncovered. A removed scene newer than the oldest survivor is not retired by that
 * bound, and neither is one whose parcels no place row ever recorded, since the parcel sweep below
 * can only describe what Places has seen. A stale enabled place is the lesser failure there and
 * bin/rebuildWorldPlaces.ts reconciles it; the event timestamp would instead leave the world
 * invisible.
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

    const activeScenes = await fetchWorldActiveScenes(worldName)
    const isTornDown = activeScenes.deploymentIds.length === 0
    const livePositions = new Set(activeScenes.positions)

    // Same lock the deployment path takes, so an in-flight deployment for this world cannot
    // commit an enabled place this event would have disabled
    const disabled = await withDatabaseTransaction(async () => {
      await WorldModel.lockWorldForDeployment(worldName)

      // Durable watermark: a deployment delivered later but produced before this event must not
      // recreate the world, and disabling rows alone leaves no record once the lock is released.
      //
      // A reshaped world cannot carry the event's own timestamp, which would reject the deployments
      // it still serves. Every survivor is at least as new as the oldest of them, so a watermark
      // placed just below that oldest one leaves all of them acceptable while still retiring
      // everything older -- in a reshape, the entire set that was removed. Only a removed scene
      // newer than the oldest survivor escapes it, and a world serving nothing that reports no
      // timestamps falls back to recording nothing at all.
      const watermarkAt = isTornDown
        ? event.timestamp
        : typeof activeScenes.oldestDeployedAt === "number"
        ? activeScenes.oldestDeployedAt - 1
        : null

      if (watermarkAt !== null) {
        await WorldUndeploymentModel.recordWatermark(worldName, watermarkAt)
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
            // decentraland-gatsby installs a global pg parser that returns timestamp columns as ISO
            // strings, so this is typed as a Date but is not one at runtime.
            undeployedAt: new Date(place.deployed_at),
          }))
        )

        // Identity only covers the rows this statement disabled, which leaves out every row that was
        // already disabled and every scene whose deployment has not arrived. Watermark the parcels
        // instead: anything Places ever recorded for this world that nothing now serves was cleared
        // by this event, and a parcel with nothing serving it cannot veto a survivor.
        const knownPositions = await PlaceModel.findWorldPositions(worldName)
        await WorldDeploymentPositionWatermarkModel.recordPositions(
          worldName,
          knownPositions.filter((position) => !livePositions.has(position)),
          new Date(event.timestamp),
          true
        )
      }

      return disabled
    })

    loggerExtended.log(
      isTornDown
        ? `Disabled all ${disabled.length} place records for world: ${worldName}`
        : `Disabled ${disabled.length} place records for reshaped world: ${worldName}, which still serves ${activeScenes.deploymentIds.length} scenes`
    )
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
