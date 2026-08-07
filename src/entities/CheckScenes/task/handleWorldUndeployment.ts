import { WorldUndeploymentEvent } from "@dcl/schemas/dist/platform/events/world"
import logger from "decentraland-gatsby/dist/entities/Development/logger"

import { withDatabaseTransaction } from "../../Database/model"
import PlaceModel from "../../Place/model"
import { notifyError } from "../../Slack/utils"
import WorldModel from "../../World/model"

/**
 * Handles WorldUndeploymentEvent from the worlds content server.
 * Disables all place records associated with the undeployed world.
 * The world entity itself is not modified -- it simply won't appear
 * in queries once it has no enabled places.
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

    // Same lock the deployment path takes, so an in-flight deployment for this world cannot
    // commit an enabled place this event would have disabled
    await withDatabaseTransaction(async () => {
      await WorldModel.lockWorldForDeployment(worldName)

      await PlaceModel.disableByWorldId(worldName, event.timestamp)
    })

    loggerExtended.log(`Disabled all place records for world: ${worldName}`)
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
