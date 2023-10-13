import { randomUUID } from "crypto"

import PlaceModel from "../../Place/model"
import { PlaceAttributes } from "../../Place/types"
import PlaceContentRatingModel from "../../PlaceContentRating/model"
import PlacePositionModel from "../../PlacePosition/model"
import {
  notifyDisablePlaces,
  notifyNewPlace,
  notifyUpdatePlace,
} from "../../Slack/utils"
import { verifyWorldsIndexing } from "../../World/task/verifyWorldsIndexing"
import CheckScenesModel from "../model"
import { CheckSceneLogsTypes } from "../types"
import { getWorldAbout } from "../utils"
import { DeploymentToSqs } from "./consumer"
import {
  ProcessEntitySceneResult,
  createPlaceFromContentEntityScene,
  processContentEntityScene,
} from "./processContentEntityScene"
import { processEntityId } from "./processEntityId"

const placesAttributes: Array<keyof PlaceAttributes> = [
  "title",
  "description",
  "image",
  "owner",
  "tags",
  "positions",
  "base_position",
  "contact_name",
  "contact_email",
  "content_rating",
  "disabled",
  "disabled_at",
  "created_at",
  "updated_at",
  "deployed_at",
  "categories",
  "world",
  "world_name",
  "hidden",
  "textsearch",
]

export async function taskRunnerSqs(job: DeploymentToSqs) {
  const contentEntityScene = await processEntityId(job)

  if (!contentEntityScene) {
    return null
  }

  let placesToProcess: ProcessEntitySceneResult | null = null

  if (
    contentEntityScene.metadata.worldConfiguration &&
    !(
      contentEntityScene.metadata.worldConfiguration.name ||
      contentEntityScene.metadata.worldConfiguration.dclName
    )
  ) {
    throw new Error("worldConfiguration without name")
  }

  if (contentEntityScene.metadata.worldConfiguration) {
    const worldName = (contentEntityScene.metadata.worldConfiguration.name ||
      contentEntityScene.metadata.worldConfiguration.dclName) as string

    const worlds = await PlaceModel.findEnabledWorldName(worldName)

    const worldIndexing = await verifyWorldsIndexing([worldName])

    if (!worlds.length) {
      const placefromContentEntity = createPlaceFromContentEntityScene(
        contentEntityScene,
        {
          hidden: !worldIndexing[0].shouldBeIndexed,
          disabled:
            !!contentEntityScene?.metadata?.worldConfiguration?.placesConfig
              ?.optOut,
        },
        { url: job.contentServerUrls![0] }
      )
      placesToProcess = {
        new: placefromContentEntity,
        rating: {
          id: randomUUID(),
          place_id: placefromContentEntity.id,
          original_rating: null,
          update_rating: placefromContentEntity.content_rating,
          moderator: null,
          comment: null,
          created_at: new Date(),
        },
        disabled: [],
      }
    } else {
      const worldAbout = await getWorldAbout(
        job.contentServerUrls![0],
        worldName
      )

      if (
        !worldAbout.configurations.scenesUrn[0].includes(job.entity.entityId)
      ) {
        throw new Error(
          `The information obtained from the World \`${worldName}\` with the \`${job.entity.entityId}\` hash is not the same as the information obtained from About. scenesUrn: \`${worldAbout.configurations.scenesUrn[0]}\``
        )
      }

      const placefromContentEntity = createPlaceFromContentEntityScene(
        contentEntityScene,
        {
          ...worlds[0],
          hidden: !worldIndexing[0].shouldBeIndexed,
          disabled:
            !!contentEntityScene?.metadata?.worldConfiguration?.placesConfig
              ?.optOut,
        },
        { url: job.contentServerUrls![0] }
      )

      let rating = null

      if (placefromContentEntity.content_rating !== worlds[0].content_rating) {
        rating = {
          id: randomUUID(),
          place_id: worlds[0].id,
          original_rating: worlds[0].content_rating,
          update_rating: placefromContentEntity.content_rating,
          moderator: null,
          comment: null,
          created_at: new Date(),
        }
      }

      placesToProcess = {
        update: placefromContentEntity,
        rating,
        disabled: [],
      }
    }
  } else {
    const places = await PlaceModel.findEnabledByPositions(
      contentEntityScene.pointers
    )
    placesToProcess = await processContentEntityScene(
      contentEntityScene,
      places
    )
  }

  if (!placesToProcess) {
    CheckScenesModel.createOne({
      entity_id: job.entity.entityId,
      content_server_url: job.contentServerUrls![0],
      base_position: contentEntityScene.metadata.scene!.base,
      positions: contentEntityScene.metadata.scene!.parcels,
      action: CheckSceneLogsTypes.AVOID,
      deploy_at: new Date(contentEntityScene.timestamp),
    })
  }

  if (placesToProcess?.new) {
    await PlaceModel.insertPlace(placesToProcess.new, placesAttributes)
    !contentEntityScene.metadata.worldConfiguration &&
      (await PlacePositionModel.syncBasePosition(placesToProcess.new))

    notifyNewPlace(placesToProcess.new)
    CheckScenesModel.createOne({
      entity_id: job.entity.entityId,
      content_server_url: job.contentServerUrls![0],
      base_position: contentEntityScene.metadata.scene!.base,
      positions: contentEntityScene.metadata.scene!.parcels,
      action: CheckSceneLogsTypes.NEW,
      deploy_at: new Date(contentEntityScene.timestamp),
    })
  }

  if (placesToProcess?.update) {
    await PlaceModel.updatePlace(placesToProcess.update, placesAttributes)
    !contentEntityScene.metadata.worldConfiguration &&
      (await PlacePositionModel.syncBasePosition(placesToProcess.update))

    notifyUpdatePlace(placesToProcess.update)
    CheckScenesModel.createOne({
      entity_id: job.entity.entityId,
      content_server_url: job.contentServerUrls![0],
      base_position: contentEntityScene.metadata.scene!.base,
      positions: contentEntityScene.metadata.scene!.parcels,
      action: CheckSceneLogsTypes.UPDATE,
      deploy_at: new Date(contentEntityScene.timestamp),
    })
  }

  if (placesToProcess?.rating) {
    PlaceContentRatingModel.create(placesToProcess.rating)
  }

  if (placesToProcess?.disabled.length) {
    const placesIdToDisable = placesToProcess.disabled.map((place) => place.id)
    await PlaceModel.disablePlaces(placesIdToDisable)

    const positions = new Set(
      placesToProcess.disabled.flatMap((place) => place.positions)
    )
    placesToProcess?.new?.positions.forEach((position) =>
      positions.delete(position)
    )
    placesToProcess?.update?.positions.forEach((position) =>
      positions.delete(position)
    )
    !contentEntityScene.metadata.worldConfiguration &&
      (await PlacePositionModel.removePositions([...positions]))

    notifyDisablePlaces(placesToProcess.disabled)

    const placesToDisable = placesToProcess.disabled.map((place) => ({
      entity_id: job.entity.entityId,
      content_server_url: job.contentServerUrls![0],
      base_position: place.base_position,
      positions: place.positions,
      action: CheckSceneLogsTypes.DISABLED,
    }))

    CheckScenesModel.createMany(placesToDisable)
  }
}
