import logger from "decentraland-gatsby/dist/entities/Development/logger"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import env from "decentraland-gatsby/dist/utils/env"
import isURL from "validator/lib/isURL"

import { DeploymentToSqs } from "../CheckScenes/task/consumer"
import { PlaceAttributes } from "../Place/types"
import { placeUrl, worldUrl } from "../Place/utils"

const SLACK_WEBHOOK = env("SLACK_WEBHOOK", "")
const CONTENT_MODERATION_SLACK_WEBHOOK = env(
  "CONTENT_MODERATION_SLACK_WEBHOOK",
  ""
)

if (!isURL(SLACK_WEBHOOK)) {
  logger.log(`missing config SLACK_WEBHOOK`)
}

if (!isURL(CONTENT_MODERATION_SLACK_WEBHOOK)) {
  logger.log(`missing config CONTENT_MODERATION_SLACK_WEBHOOK`)
}

export async function notifyNewPlace(
  place: PlaceAttributes,
  entity: DeploymentToSqs
) {
  logger.log(`sending new place "${place.id}" to slack`)
  await sendToSlack({
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:tada: New ${place.world ? "world" : "place"} added: ${
            place.world
              ? `<${worldUrl(place)}|${place.world_name}>`
              : `<${placeUrl(place)}|${place.base_position}>`
          }`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            place.title,
            place.description,
            `UUID: ${place.id} (<${entity.contentServerUrls}/contents/${entity.entity.entityId}|Entity>)`,
          ].join("\n\n"),
        },
        accessory: {
          type: "image",
          image_url: place.image,
          alt_text: place.title || "Place - Decentraland",
        },
      },
    ],
  })
}

export async function notifyUpdatePlace(
  place: PlaceAttributes,
  entity: DeploymentToSqs
) {
  logger.log(`sending update place "${place.id}" to slack`)
  await sendToSlack({
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:white_check_mark: ${
            place.world ? "world" : "Place"
          } updated: ${
            place.world
              ? `<${worldUrl(place)}|${place.world_name}>`
              : `<${placeUrl(place)}|${place.base_position}>`
          }`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            place.title,
            place.description,
            `UUID: ${place.id} (<${entity.contentServerUrls}/contents/${entity.entity.entityId}|Entity>)`,
          ].join("\n\n"),
        },
        accessory: {
          type: "image",
          image_url: place.image,
          alt_text: place.title || "Place - Decentraland",
        },
      },
    ],
  })
}

export async function notifyDisablePlaces(places: PlaceAttributes[]) {
  logger.log(
    `sending disable place "${places
      .map((place) => place.id)
      .join(", ")}" to slack`
  )
  await sendToSlack({
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:x: ${places.length} ${
            places.length > 1 ? "places" : "place"
          } disabled in: ${places
            .map((place) =>
              place.world ? place.world_name : place.base_position
            )
            .join(" - ")}`,
        },
      },
      {
        type: "section",
        text: {
          type: "plain_text",
          text: places
            .map(
              (place) =>
                `${place.title} (${
                  place.world ? place.world_name : place.base_position
                })\nUUID: ${place.id}`
            )
            .join("\n\n"),
        },
      },
    ],
  })
}

export async function notifyError(messages: string[]) {
  logger.log(`sending error to slack`)
  await sendToSlack({
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:exclamation: There was an error`,
        },
      },
      ...messages.map((message) => ({
        type: "section",
        text: {
          type: "mrkdwn",
          text: message,
        },
      })),
    ],
  })
}

async function sendToSlack(body: {}) {
  if (!isURL(SLACK_WEBHOOK)) {
    return
  }

  try {
    const response = await fetch(SLACK_WEBHOOK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const data = await response.text()

    if (response.status >= 400) {
      logger.error(`Slack bad request: ${data} (${response.status})`)
    }
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Slack service error: ` + error.message, error)
    }
  }
}

export async function notifyDowngradeRating(
  place: PlaceAttributes,
  ratingProposed: SceneContentRating
) {
  logger.log(
    `sending downgrade rating "${place.title}" to content moderation slack`
  )
  await sendToContentModeratorSlack({
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:warning: The ${
            place.world ? "world" : "place"
          } updated trying to downgrade rating: ${
            place.world
              ? `<${worldUrl(place)}|${place.world_name}>`
              : `<${placeUrl(place)}|${place.base_position}>`
          }`,
        },
      },
      {
        type: "section",
        text: {
          type: "plain_text",
          text: `Actual rating: ${place.content_rating} - Proposed rating: ${ratingProposed}`,
        },
      },
    ],
  })
}

export async function notifyUpgradingRating(
  place: PlaceAttributes,
  updatedBy: "Content Moderator" | "Content Creator",
  ratingProposed: SceneContentRating
) {
  logger.log(
    `sending upgrading rating "${place.title}" to content moderation slack`
  )
  await sendToContentModeratorSlack({
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:white_check_mark: The ${
            place.world ? "world" : "place"
          } upgrade rating: ${
            place.world
              ? `<${worldUrl(place)}|${place.world_name}>`
              : `<${placeUrl(place)}|${place.base_position}>`
          }`,
        },
      },
      {
        type: "section",
        text: {
          type: "plain_text",
          text: `The rating was upgraded by ${updatedBy}`,
        },
      },
      {
        type: "section",
        text: {
          type: "plain_text",
          text: `Previous rating: ${place.content_rating} - New rating: ${ratingProposed}`,
        },
      },
    ],
  })
}

async function sendToContentModeratorSlack(body: {}) {
  if (!isURL(CONTENT_MODERATION_SLACK_WEBHOOK)) {
    return
  }

  try {
    const response = await fetch(CONTENT_MODERATION_SLACK_WEBHOOK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const data = await response.text()

    if (response.status >= 400) {
      logger.error(`Slack bad request: ${data} (${response.status})`)
    }
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Slack service error: ` + error.message, error)
    }
  }
}
