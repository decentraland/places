import logger from "decentraland-gatsby/dist/entities/Development/logger"

import {
  WorldSqsMessage,
  isDeploymentEvent,
  isScenesUndeploymentEvent,
  isSettingsChangedEvent,
  isWorldUndeploymentEvent,
} from "./consumer"
import { handleWorldScenesUndeployment } from "./handleWorldScenesUndeployment"
import { handleWorldSettingsChanged } from "./handleWorldSettingsChanged"
import { handleWorldUndeployment } from "./handleWorldUndeployment"
import { taskRunnerSqs } from "./taskRunnerSqs"

/**
 * Main dispatcher that routes SQS messages to the appropriate handler
 * based on the event type.
 */
export async function taskRunnerDispatcher(
  message: WorldSqsMessage
): Promise<any> {
  if (isSettingsChangedEvent(message)) {
    logger.log(`Processing WorldSettingsChangedEvent for world: ${message.key}`)
    return handleWorldSettingsChanged(message)
  }

  if (isWorldUndeploymentEvent(message)) {
    logger.log(
      `Processing WorldUndeploymentEvent for world: ${message.metadata.worldName}`
    )
    return handleWorldUndeployment(message)
  }

  if (isScenesUndeploymentEvent(message)) {
    logger.log(
      `Processing WorldScenesUndeploymentEvent for world: ${message.metadata.worldName}`
    )
    return handleWorldScenesUndeployment(message)
  }

  if (isDeploymentEvent(message)) {
    logger.log(
      `Processing DeploymentEvent for entity: ${message.entity.entityId}`
    )
    return taskRunnerSqs(message)
  }

  // Unknown event type - log and skip
  logger.warning(`Unknown event type received: ${JSON.stringify(message)}`)
  return null
}
