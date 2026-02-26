import { WorldScenesUndeploymentEvent } from "@dcl/schemas/dist/platform/events/world"
import logger from "decentraland-gatsby/dist/entities/Development/logger"

import { notifyError } from "../../Slack/utils"
import WorldModel from "../../World/model"

/**
 * Handles WorldScenesUndeploymentEvent from the worlds content server.
 * Atomically deletes place records for undeployed scenes and refreshes
 * the world's deployment-derived fields from the next-latest remaining scene.
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

    await WorldModel.deleteWorldScenesAndRefresh(
      worldName,
      basePositions,
      event.timestamp
    )

    loggerExtended.log(
      `Deleted place records and refreshed world: ${worldName} at positions: ${basePositions.join(
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
