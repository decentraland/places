import logger from "decentraland-gatsby/dist/entities/Development/logger"

import {
  WorldSqsMessage,
  WorldSqsMessageAttributes,
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
 * based on the event type. Removal and settings events are read back from the worlds server named
 * by the source attribute; deployments name their server in the body.
 */
export async function taskRunnerDispatcher(
  message: WorldSqsMessage,
  attributes: WorldSqsMessageAttributes = {}
): Promise<any> {
  const { sourceContentServerUrl } = attributes

  if (isSettingsChangedEvent(message)) {
    logger.log(`Processing WorldSettingsChangedEvent for world: ${message.key}`)
    return handleWorldSettingsChanged(
      message,
      undefined,
      undefined,
      sourceContentServerUrl
    )
  }

  if (isWorldUndeploymentEvent(message)) {
    logger.log(
      `Processing WorldUndeploymentEvent for world: ${message.metadata.worldName}`
    )
    return handleWorldUndeployment(message, sourceContentServerUrl)
  }

  if (isScenesUndeploymentEvent(message)) {
    logger.log(
      `Processing WorldScenesUndeploymentEvent for world: ${message.metadata.worldName}`
    )
    return handleWorldScenesUndeployment(message, sourceContentServerUrl)
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
