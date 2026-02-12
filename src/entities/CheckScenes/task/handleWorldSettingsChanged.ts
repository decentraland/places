import { WorldSettingsChangedEvent } from "@dcl/schemas/dist/platform/events/world"
import logger from "decentraland-gatsby/dist/entities/Development/logger"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import {
  isDowngradingRating,
  isUpgradingRating,
} from "../../../utils/rating/contentRating"
import {
  notifyDowngradeRating,
  notifyError,
  notifyUpgradingRating,
} from "../../Slack/utils"
import WorldModel from "../../World/model"

/**
 * Handles WorldSettingsChangedEvent from the worlds content server.
 * Updates the world record with the new settings.
 * If the world doesn't exist yet, creates it.
 *
 * Note: Content creators cannot downgrade ratings - only moderators can.
 * If a downgrade is attempted, the original rating is preserved and
 * moderators are notified.
 */
export async function handleWorldSettingsChanged(
  event: WorldSettingsChangedEvent
): Promise<void> {
  const worldName = event.key

  if (!worldName) {
    logger.error("WorldSettingsChangedEvent missing world name (key)")
    return
  }

  const loggerExtended = logger.extend({
    worldName,
    eventType: "WorldSettingsChangedEvent",
  })

  try {
    loggerExtended.log(`Processing settings change for world: ${worldName}`)

    const newContentRating =
      (event.metadata.contentRating as SceneContentRating) ||
      SceneContentRating.RATING_PENDING

    // Check if this is a rating change attempt on an existing world
    const existingWorld = await WorldModel.findByWorldName(worldName)
    let contentRatingToUse: SceneContentRating | undefined = newContentRating

    if (existingWorld && existingWorld.content_rating) {
      if (isDowngradingRating(newContentRating, existingWorld.content_rating)) {
        // Content creators cannot downgrade ratings - notify moderators
        loggerExtended.log(
          `Blocked rating downgrade attempt for world ${worldName}: ` +
            `${existingWorld.content_rating} -> ${newContentRating}`
        )
        notifyDowngradeRating(existingWorld, newContentRating)
        // Keep the original rating
        contentRatingToUse = undefined
      } else if (
        isUpgradingRating(newContentRating, existingWorld.content_rating)
      ) {
        // Notify about rating upgrade
        notifyUpgradingRating(
          existingWorld,
          "Content Creator",
          newContentRating
        )
      }
    }

    // Derive is_private from the accessType metadata field.
    // Only set is_private when accessType is explicitly provided.
    const accessType = (event.metadata as { accessType?: string }).accessType
    const isPrivate =
      accessType !== undefined ? accessType !== "unrestricted" : undefined

    await WorldModel.upsertWorld({
      world_name: worldName,
      title: event.metadata.title,
      description: event.metadata.description,
      content_rating: contentRatingToUse,
      categories: event.metadata.categories,
      image: event.metadata.thumbnailUrl,
      show_in_places: event.metadata.showInPlaces,
      single_player: event.metadata.singlePlayer,
      skybox_time: event.metadata.skyboxTime,
      is_private: isPrivate,
    })

    loggerExtended.log(`Upserted world settings for: ${worldName}`)
  } catch (error: any) {
    loggerExtended.error(
      `Error handling WorldSettingsChangedEvent for ${worldName}: ${error.message}`
    )
    notifyError([
      `Error handling WorldSettingsChangedEvent`,
      `World: ${worldName}`,
      error.message,
    ])
    throw error
  }
}
