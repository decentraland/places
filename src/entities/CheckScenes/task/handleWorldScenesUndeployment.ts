import { WorldScenesUndeploymentEvent } from "@dcl/schemas/dist/platform/events/world"
import logger from "decentraland-gatsby/dist/entities/Development/logger"

import PlaceModel from "../../Place/model"
import { notifyError } from "../../Slack/utils"

/**
 * Handles WorldScenesUndeploymentEvent from the worlds content server.
 * Disables the place records corresponding to the undeployed scenes,
 * identified by world name and immutable deployment id, with a guarded fallback for legacy rows.
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
    const deploymentIds = scenes.map((scene) => scene.entityId)

    loggerExtended.log(
      `Processing scene undeployment for world: ${worldName}, parcels: ${basePositions.join(
        ", "
      )}`
    )

    await PlaceModel.disableByWorldIdAndDeployments(
      worldName,
      deploymentIds,
      basePositions,
      event.timestamp
    )

    loggerExtended.log(
      `Disabled place records for world: ${worldName} at positions: ${basePositions.join(
        ", "
      )}`
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    loggerExtended.error(
      `Error handling WorldScenesUndeploymentEvent for ${worldName}: ${message}`
    )
    notifyError([
      `Error handling WorldScenesUndeploymentEvent`,
      `World: ${worldName}`,
      message,
    ])
    throw error
  }
}
