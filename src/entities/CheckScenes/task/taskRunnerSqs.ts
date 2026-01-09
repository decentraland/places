import { randomUUID } from "crypto"

import CategoryModel from "../../Category/model"
import { DecentralandCategories } from "../../Category/types"
import PlaceModel from "../../Place/model"
import { PlaceAttributes } from "../../Place/types"
import PlaceCategories from "../../PlaceCategories/model"
import PlaceContentRatingModel from "../../PlaceContentRating/model"
import PlacePositionModel from "../../PlacePosition/model"
import {
  notifyDisablePlaces,
  notifyNewPlace,
  notifyUpdatePlace,
} from "../../Slack/utils"
import CheckScenesModel from "../model"
import { CheckSceneLogsTypes } from "../types"
import {
  fetchWorldInformation,
  getWorldAbout,
  updateGenesisCityManifest,
} from "../utils"
import { DeploymentToSqs } from "./consumer"
import { extractCreatorAddress } from "./extractCreatorAddress"
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
  "world",
  "world_name",
  "textsearch",
  "creator_address",
]

export async function taskRunnerSqs(job: DeploymentToSqs) {
  const contentEntityScene = await processEntityId(job)

  if (!contentEntityScene) {
    return null
  }

  // Extract creator address from scene.json
  const creatorAddress = await extractCreatorAddress(
    contentEntityScene,
    job.contentServerUrls![0]
  )

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

    // fallback to get the owner of the world in case is missing
    if (!worlds.length || !contentEntityScene.metadata.owner) {
      const worldInformation = await fetchWorldInformation(
        worldName,
        job.contentServerUrls![0]
      )

      if (worldInformation) {
        contentEntityScene.metadata.owner = worldInformation?.metadata?.owner
      }
    }

    if (!worlds.length) {
      const placefromContentEntity = createPlaceFromContentEntityScene(
        contentEntityScene,
        {
          disabled:
            !!contentEntityScene?.metadata?.worldConfiguration?.placesConfig
              ?.optOut,
        },
        { url: job.contentServerUrls![0], creator: creatorAddress }
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
          disabled:
            !!contentEntityScene?.metadata?.worldConfiguration?.placesConfig
              ?.optOut,
        },
        { url: job.contentServerUrls![0], creator: creatorAddress }
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
    placesToProcess = processContentEntityScene(contentEntityScene, places, {
      url: job.contentServerUrls![0],
      creator: creatorAddress,
    })
  }

  if (!placesToProcess) {
    await CheckScenesModel.createOne({
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

    await overridePlaceCategories(
      placesToProcess.new.id,
      contentEntityScene.metadata.tags || []
    )

    notifyNewPlace(placesToProcess.new, job)
    await CheckScenesModel.createOne({
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

    await overridePlaceCategories(
      placesToProcess.update.id,
      contentEntityScene.metadata.tags || []
    )

    notifyUpdatePlace(placesToProcess.update, job)
    await CheckScenesModel.createOne({
      entity_id: job.entity.entityId,
      content_server_url: job.contentServerUrls![0],
      base_position: contentEntityScene.metadata.scene!.base,
      positions: contentEntityScene.metadata.scene!.parcels,
      action: CheckSceneLogsTypes.UPDATE,
      deploy_at: new Date(contentEntityScene.timestamp),
    })
  }

  if (placesToProcess?.rating) {
    await PlaceContentRatingModel.create(placesToProcess.rating)
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

    await CheckScenesModel.createMany(placesToDisable)
  }

  // do not await so it is done on background
  updateGenesisCityManifest()
}

async function getValidCategories(creatorTags: string[]) {
  const forbidden = [
    DecentralandCategories.POI,
    DecentralandCategories.FEATURED,
  ] as string[]

  const availableCategories = await CategoryModel.findActiveCategories()

  const validCategories = new Set<string>()

  for (const tag of creatorTags) {
    if (forbidden.includes(tag)) continue

    if (availableCategories.find(({ name }) => name === tag)) {
      validCategories.add(tag)
    }

    if (validCategories.size === 3) break
  }

  return validCategories
}

async function overridePlaceCategories(placeId: string, creatorTags: string[]) {
  if (!creatorTags.length) return

  const validCategories = await getValidCategories(creatorTags)

  if (!validCategories.size) return

  const currentCategories = new Set(
    ...(await PlaceCategories.findCategoriesByPlaceId(placeId)).map(
      ({ category_id }) => category_id
    )
  )

  if (currentCategories.has(DecentralandCategories.POI)) {
    validCategories.add(DecentralandCategories.POI)
  }

  if (currentCategories.has(DecentralandCategories.FEATURED)) {
    validCategories.add(DecentralandCategories.FEATURED)
  }

  await PlaceCategories.cleanPlaceCategories(placeId)
  await PlaceModel.overrideCategories(placeId, [...validCategories])

  await PlaceCategories.addCategoriesToPlaces(
    [...validCategories].map((category) => [placeId, category])
  )
}
