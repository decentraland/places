import { randomUUID } from "crypto"

import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { isDowngradingRating } from "../../../utils/rating/contentRating"
import CategoryModel from "../../Category/model"
import { DecentralandCategories } from "../../Category/types"
import PlaceModel from "../../Place/model"
import { DisabledReason, PlaceAttributes } from "../../Place/types"
import PlaceCategories from "../../PlaceCategories/model"
import PlaceContentRatingModel from "../../PlaceContentRating/model"
import PlacePositionModel from "../../PlacePosition/model"
import {
  notifyDisablePlaces,
  notifyNewPlace,
  notifyUpdatePlace,
} from "../../Slack/utils"
import WorldModel from "../../World/model"
import CheckScenesModel from "../model"
import { CheckSceneLogsTypes } from "../types"
import { updateGenesisCityManifest } from "../utils"
import { DeploymentToSqs } from "./consumer"
import { extractSceneJsonData } from "./extractSceneJsonData"
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
  "disabled_reason",
  "created_at",
  "updated_at",
  "deployed_at",
  "world",
  "world_name",
  "world_id",
  "textsearch",
  "creator_address",
  "sdk",
]

export async function taskRunnerSqs(job: DeploymentToSqs) {
  const contentEntityScene = await processEntityId(job)

  if (!contentEntityScene) {
    return null
  }

  // Extract creator address and SDK version from scene.json
  const sceneJsonData = await extractSceneJsonData(
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

    // Determine if opt-out is set
    const isOptOut =
      !!contentEntityScene?.metadata?.worldConfiguration?.placesConfig?.optOut

    const newContentRating =
      (contentEntityScene?.metadata?.policy
        ?.contentRating as SceneContentRating) || undefined

    // Apply rating downgrade protection: content creators cannot downgrade
    // ratings — only moderators can. If the incoming rating is lower than the
    // existing one, keep the current rating by passing undefined (upsertWorld
    // skips undefined fields).
    const existingWorld = await WorldModel.findByWorldName(worldName)
    const contentRatingToUse =
      existingWorld?.content_rating &&
      newContentRating &&
      isDowngradingRating(newContentRating, existingWorld.content_rating)
        ? undefined
        : newContentRating

    // Upsert the world so that every scene deployment keeps the world record
    // in sync (owner, title, description, categories, show_in_places, etc.).
    const world = await WorldModel.upsertWorld({
      world_name: worldName,
      title:
        contentEntityScene?.metadata?.display?.title?.slice(0, 50) || undefined,
      description:
        contentEntityScene?.metadata?.display?.description || undefined,
      content_rating: contentRatingToUse,
      categories: contentEntityScene?.metadata?.tags || undefined,
      owner: contentEntityScene?.metadata?.owner || undefined,
      show_in_places: isOptOut ? false : undefined,
    })
    const worldId = world.id

    // Find the existing place for this scene by world_id and base_position
    const basePosition =
      contentEntityScene?.metadata?.scene?.base ||
      (contentEntityScene?.pointers || [])[0]
    const existingPlace = await PlaceModel.findByWorldIdAndBasePosition(
      worldId,
      basePosition
    )

    const shouldCreateNewPlace =
      !existingPlace ||
      (existingPlace.disabled &&
        (existingPlace.disabled_reason === DisabledReason.UNDEPLOYMENT ||
          existingPlace.disabled_reason === DisabledReason.OVERWRITTEN))

    if (shouldCreateNewPlace) {
      // Create a new place: either no existing place, or the existing one was
      // disabled by undeployment/overlap and should not be resurrected.
      const placefromContentEntity = createPlaceFromContentEntityScene(
        contentEntityScene,
        {
          disabled: isOptOut,
          disabled_reason: isOptOut ? DisabledReason.OPT_OUT : null,
        },
        {
          url: job.contentServerUrls![0],
          creator: sceneJsonData.creator,
          sdk: sceneJsonData.runtimeVersion,
          worldId,
        }
      )
      placesToProcess = {
        new: placefromContentEntity,
        rating: {
          id: randomUUID(),
          entity_id: placefromContentEntity.id,
          original_rating: null,
          update_rating: placefromContentEntity.content_rating,
          moderator: null,
          comment: null,
          created_at: new Date(),
        },
        disabled: [],
      }
    } else {
      // Update the existing place: either it's enabled, or it was disabled
      // by opt_out and can be re-enabled if opt-out is now removed.
      const placefromContentEntity = createPlaceFromContentEntityScene(
        contentEntityScene,
        {
          ...existingPlace,
          disabled: isOptOut,
          disabled_reason: isOptOut ? DisabledReason.OPT_OUT : null,
        },
        {
          url: job.contentServerUrls![0],
          creator: sceneJsonData.creator,
          sdk: sceneJsonData.runtimeVersion,
          worldId,
        }
      )

      let rating = null

      if (
        placefromContentEntity.content_rating !== existingPlace.content_rating
      ) {
        rating = {
          id: randomUUID(),
          entity_id: existingPlace.id,
          original_rating: existingPlace.content_rating,
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
      creator: sceneJsonData.creator,
      sdk: sceneJsonData.runtimeVersion,
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
