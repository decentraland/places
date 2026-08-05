import { WorldScenesUndeploymentEvent } from "@dcl/schemas/dist/platform/events/world"
import logger from "decentraland-gatsby/dist/entities/Development/logger"

import PlaceModel from "../../Place/model"
import { notifyError } from "../../Slack/utils"

/**
 * Handles WorldScenesUndeploymentEvent from the worlds content server.
 *
 * A place id is a local catalog UUID that may be preserved across redeployments so favorites,
 * moderation and other product state remain attached to the logical place. The worlds content
 * server neither owns nor knows that UUID. Its entity id instead identifies the exact immutable
 * deployment that produced the event. Matching the stored deployment id prevents a delayed
 * undeployment for an older entity from disabling a place that already represents a newer one.
 * Legacy rows without deployment ids use the guarded base-position fallback below.
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

    const result = await PlaceModel.disableByWorldIdAndDeployments(
      worldName,
      deploymentIds,
      basePositions,
      event.timestamp
    )

    if (result.legacyBaseMatches > 0) {
      loggerExtended.log(
        `WARNING: disabled ${result.legacyBaseMatches} legacy place records without deployment ids; replay world deployments to reconcile them`
      )
    }

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
