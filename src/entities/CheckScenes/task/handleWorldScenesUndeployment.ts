import { WorldScenesUndeploymentEvent } from "@dcl/schemas/dist/platform/events/world"
import logger from "decentraland-gatsby/dist/entities/Development/logger"

import PlaceModel from "../../Place/model"
import { notifyError } from "../../Slack/utils"

/**
 * Handles WorldScenesUndeploymentEvent from the worlds content server.
 * Deletes the place records corresponding to the undeployed scenes,
 * identified by world name and each scene's base parcel.
 */
export async function handleWorldScenesUndeployment(
  event: WorldScenesUndeploymentEvent
): Promise<void> {
  const worldName = event.metadata.worldName

  if (!worldName) {
    logger.error("WorldScenesUndeploymentEvent missing world name")
    return
  }

  const { scenes } = event.metadata

  if (!scenes || scenes.length === 0) {
    logger.error("WorldScenesUndeploymentEvent has no scenes")
    return
  }

  const loggerExtended = logger.extend({
    worldName,
    sceneCount: scenes.length,
    eventType: "WorldScenesUndeploymentEvent",
  })

  try {
    const basePositions = scenes.map((scene) => scene.baseParcel)

    loggerExtended.log(
      `Processing scene undeployment for world: ${worldName}, parcels: ${basePositions.join(
        ", "
      )}`
    )

    await PlaceModel.deleteByWorldIdAndPositions(
      worldName,
      basePositions,
      event.timestamp
    )

    loggerExtended.log(
      `Deleted place records for world: ${worldName} at positions: ${basePositions.join(
        ", "
      )}`
    )
  } catch (error: any) {
    loggerExtended.error(
      `Error handling WorldScenesUndeploymentEvent for ${worldName}: ${error.message}`
    )
    notifyError([
      `Error handling WorldScenesUndeploymentEvent`,
      `World: ${worldName}`,
      error.message,
    ])
    throw error
  }
}
