import { ContentEntityScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { DeploymentDecision } from "./deploymentDecision"
import { InvalidSceneBaseError } from "./errors"
import { ProcessEntitySceneResult } from "./processContentEntityScene"
import CategoryModel from "../../Category/model"
import { DecentralandCategories } from "../../Category/types"
import PlaceModel from "../../Place/model"
import { PlaceAttributes } from "../../Place/types"
import PlaceCategories from "../../PlaceCategories/model"
import PlaceContentRatingModel from "../../PlaceContentRating/model"
import PlacePositionModel from "../../PlacePosition/model"
import WorldDeploymentPositionWatermarkModel from "../../WorldDeploymentPositionWatermark/model"
import WorldSceneUndeploymentModel from "../../WorldSceneUndeployment/model"
import CheckScenesModel from "../model"
import { CheckSceneLogsTypes } from "../types"

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
  "deployment_id",
  "textsearch",
  "creator_address",
  "sdk",
]

export type AppliedDeploymentDecision = {
  placesToProcess: ProcessEntitySceneResult | null
  placesToDisable: PlaceAttributes[]
}

type ApplyDeploymentDecisionOptions = {
  contentEntityScene: ContentEntityScene
  contentServerUrl: string
  decision: DeploymentDecision
  deploymentId: string
}

/** Apply a resolved deployment decision inside the caller's database transaction. */
export async function applyDeploymentDecision({
  contentEntityScene,
  contentServerUrl,
  decision,
  deploymentId,
}: ApplyDeploymentDecisionOptions): Promise<AppliedDeploymentDecision> {
  const scene = contentEntityScene.metadata.scene
  if (!scene) {
    throw new InvalidSceneBaseError(undefined)
  }

  let placesToProcess = decision.placesToProcess

  if (placesToProcess?.new) {
    await PlaceModel.insertPlace(placesToProcess.new, placesAttributes)
    await Promise.all([
      decision.kind === "genesis-city" &&
        PlacePositionModel.syncBasePosition(placesToProcess.new),
      overridePlaceCategories(
        placesToProcess.new.id,
        contentEntityScene.metadata.tags || []
      ),
      CheckScenesModel.createOne({
        entity_id: deploymentId,
        content_server_url: contentServerUrl,
        base_position: scene.base,
        positions: scene.parcels,
        action: CheckSceneLogsTypes.NEW,
        deploy_at: new Date(contentEntityScene.timestamp),
      }),
    ])
  }

  if (placesToProcess?.update) {
    const updatedPlaces = await PlaceModel.updatePlaceFromDeployment(
      placesToProcess.update,
      placesAttributes
    )

    if (updatedPlaces === 0) {
      // The stored place already holds a newer revision, so none of this deployment's
      // conditional Genesis City replacements may be applied.
      placesToProcess = null
    } else {
      await Promise.all([
        decision.kind === "genesis-city" &&
          PlacePositionModel.syncBasePosition(placesToProcess.update),
        overridePlaceCategories(
          placesToProcess.update.id,
          contentEntityScene.metadata.tags || []
        ),
        CheckScenesModel.createOne({
          entity_id: deploymentId,
          content_server_url: contentServerUrl,
          base_position: scene.base,
          positions: scene.parcels,
          action: CheckSceneLogsTypes.UPDATE,
          deploy_at: new Date(contentEntityScene.timestamp),
        }),
      ])

      if (decision.kind === "world" && decision.replacement.updatedPlace) {
        await recordReplacementRemovals(
          decision.positionWatermark.worldId,
          [decision.replacement.updatedPlace],
          contentEntityScene.timestamp
        )
      }
    }
  }

  if (!placesToProcess) {
    await CheckScenesModel.createOne({
      entity_id: deploymentId,
      content_server_url: contentServerUrl,
      base_position: scene.base,
      positions: scene.parcels,
      action: CheckSceneLogsTypes.AVOID,
      deploy_at: new Date(contentEntityScene.timestamp),
    })
  }

  let placesToDisable: PlaceAttributes[]
  if (decision.kind === "world") {
    placesToDisable = await PlaceModel.disableReplacedWorldPlaces(
      decision.replacement.candidates.map((place) => place.id),
      new Date(contentEntityScene.timestamp),
      decision.replacement.includesTimestampTies
    )
    if (placesToProcess) {
      placesToProcess.disabled = placesToDisable
    }
    if (placesToDisable.length > 0) {
      await recordReplacementRemovals(
        decision.positionWatermark.worldId,
        placesToDisable,
        contentEntityScene.timestamp
      )
    }
  } else {
    placesToDisable = placesToProcess ? decision.replacement.candidates : []
    if (placesToDisable.length > 0) {
      await PlaceModel.disablePlaces(placesToDisable.map((place) => place.id))
    }
  }

  if (decision.kind === "world") {
    await WorldDeploymentPositionWatermarkModel.recordPositions(
      decision.positionWatermark.worldId,
      decision.positionWatermark.positions,
      decision.positionWatermark.deployedAt
    )
  }

  await Promise.all([
    placesToProcess?.rating &&
      PlaceContentRatingModel.createOne(placesToProcess.rating),
    placesToDisable.length > 0 &&
      recordDisabledPlaces({
        contentServerUrl,
        decision,
        deploymentId,
        placesToDisable,
        placesToProcess,
      }),
  ])

  return { placesToProcess, placesToDisable }
}

type RecordDisabledPlacesOptions = {
  contentServerUrl: string
  decision: DeploymentDecision
  deploymentId: string
  placesToDisable: PlaceAttributes[]
  placesToProcess: ProcessEntitySceneResult | null
}

async function recordDisabledPlaces({
  contentServerUrl,
  decision,
  deploymentId,
  placesToDisable,
  placesToProcess,
}: RecordDisabledPlacesOptions): Promise<void> {
  const positions = new Set(placesToDisable.flatMap((place) => place.positions))
  placesToProcess?.new?.positions.forEach((position) =>
    positions.delete(position)
  )
  placesToProcess?.update?.positions.forEach((position) =>
    positions.delete(position)
  )

  await Promise.all([
    decision.kind === "genesis-city" &&
      PlacePositionModel.removePositions([...positions]),
    CheckScenesModel.createMany(
      placesToDisable.map((place) => ({
        entity_id: deploymentId,
        content_server_url: contentServerUrl,
        base_position: place.base_position,
        positions: place.positions,
        action: CheckSceneLogsTypes.DISABLED,
      }))
    ),
  ])
}

async function recordReplacementRemovals(
  worldId: string,
  replacedPlaces: PlaceAttributes[],
  replacedAt: number
): Promise<void> {
  await WorldSceneUndeploymentModel.recordScenes(
    worldId,
    replacedPlaces.map((place) => ({
      // Legacy rows predate deployment ids. Their stable local id gives the watermark a unique
      // key while base-position matching still protects older deployments for that scene.
      entityId: place.deployment_id || `legacy-place:${place.id}`,
      baseParcel: place.base_position,
    })),
    replacedAt
  )
}

async function getValidCategories(creatorTags: string[]): Promise<Set<string>> {
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

async function overridePlaceCategories(
  placeId: string,
  creatorTags: string[]
): Promise<void> {
  if (!creatorTags.length) return

  const [validCategories, currentCategoryRows] = await Promise.all([
    getValidCategories(creatorTags),
    PlaceCategories.findCategoriesByPlaceId(placeId),
  ])

  if (!validCategories.size) return

  const currentCategories = new Set(
    currentCategoryRows.map(({ category_id }) => category_id)
  )

  if (currentCategories.has(DecentralandCategories.POI)) {
    validCategories.add(DecentralandCategories.POI)
  }

  if (currentCategories.has(DecentralandCategories.FEATURED)) {
    validCategories.add(DecentralandCategories.FEATURED)
  }

  await Promise.all([
    PlaceCategories.cleanPlaceCategories(placeId),
    PlaceModel.overrideCategories(placeId, [...validCategories]),
  ])

  await PlaceCategories.addCategoriesToPlaces(
    [...validCategories].map((category) => [placeId, category])
  )
}
