import { WorldUndeploymentEvent } from "@dcl/schemas/dist/platform/events/world"
import logger from "decentraland-gatsby/dist/entities/Development/logger"

import PlaceModel from "../../Place/model"
import { notifyError } from "../../Slack/utils"

/**
 * Handles WorldUndeploymentEvent from the worlds content server.
 * Deletes all place records associated with the undeployed world.
 * The world entity itself is not deleted -- it simply won't appear
 * in queries once it has no associated places.
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

    await PlaceModel.deleteByWorldId(worldName, event.timestamp)

    loggerExtended.log(`Deleted all place records for world: ${worldName}`)
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
