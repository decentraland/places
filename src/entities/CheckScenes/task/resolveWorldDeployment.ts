import { randomUUID } from "crypto"

import {
  ContentEntityScene,
  SceneContentRating,
} from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { WorldDeploymentDecision } from "./deploymentDecision"
import { InvalidSceneBaseError } from "./errors"
import { createPlaceFromContentEntityScene } from "./processContentEntityScene"
import PlaceModel from "../../Place/model"
import { DisabledReason, PlaceAttributes } from "../../Place/types"
import { sanitizePlaceDescription } from "../../Place/utils"
import WorldModel from "../../World/model"
import WorldDeploymentPositionWatermarkModel from "../../WorldDeploymentPositionWatermark/model"
import WorldSceneUndeploymentModel from "../../WorldSceneUndeployment/model"
import WorldUndeploymentModel from "../../WorldUndeployment/model"

type ResolveWorldDeploymentOptions = {
  contentEntityScene: ContentEntityScene
  contentServerUrl: string
  creator: string | null
  deploymentId: string
  nameOwner: string | null | undefined
  sdk: string | null
  worldName: string
}

/**
 * Resolve a world deployment into the place mutation and durable replacement intents that the
 * task runner must apply. The caller owns the surrounding database transaction; this helper owns
 * the per-world lock and guarantees no world row is written for a superseded deployment.
 */
export async function resolveWorldDeployment({
  contentEntityScene,
  contentServerUrl,
  creator,
  deploymentId,
  nameOwner,
  sdk,
  worldName,
}: ResolveWorldDeploymentOptions): Promise<WorldDeploymentDecision> {
  const scene = contentEntityScene.metadata.scene
  if (!scene) {
    throw new InvalidSceneBaseError(undefined)
  }

  await WorldModel.lockWorldForDeployment(worldName)

  const worldId = worldName.toLowerCase()
  const deployedAt = new Date(contentEntityScene.timestamp)
  const positions = contentEntityScene.pointers
  const positionWatermark = { worldId, positions, deployedAt }
  const overlappingPlaces = await PlaceModel.findActiveByWorldIdAndPositions(
    worldId,
    positions
  )
  const hasNewerPlace = await PlaceModel.hasNewerActiveWorldDeployment(
    worldId,
    positions,
    deployedAt
  )
  const [worldUndeployment, sceneUndeployment, hasNewerPositionWatermark] =
    await Promise.all([
      WorldUndeploymentModel.findSupersedingUndeployment(worldId, deployedAt),
      WorldSceneUndeploymentModel.findSupersedingUndeployment(
        worldId,
        deploymentId,
        scene.base,
        deployedAt
      ),
      WorldDeploymentPositionWatermarkModel.hasSupersedingDeployment(
        worldId,
        positions,
        deployedAt
      ),
    ])
  const isSuperseded = !!(
    hasNewerPlace ||
    worldUndeployment ||
    sceneUndeployment ||
    hasNewerPositionWatermark
  )

  if (isSuperseded) {
    // The deployment contributes no place, but its upstream replacement effect still applies to
    // strictly older overlaps and its complete footprint must become a durable watermark.
    return {
      kind: "world",
      placesToProcess: null,
      replacement: {
        candidates: overlappingPlaces,
        includesTimestampTies: false,
        updatedPlace: null,
      },
      positionWatermark,
    }
  }

  const isOptOut =
    !!contentEntityScene.metadata.worldConfiguration?.placesConfig?.optOut
  await WorldModel.insertWorldIfNotExists({
    world_name: worldName,
    title:
      contentEntityScene.metadata.display?.title?.slice(0, 50) || undefined,
    description:
      sanitizePlaceDescription(
        contentEntityScene.metadata.display?.description
      ) || undefined,
    content_rating:
      (contentEntityScene.metadata.policy
        ?.contentRating as SceneContentRating) || undefined,
    categories: contentEntityScene.metadata.tags || undefined,
    owner: nameOwner || undefined,
    show_in_places: !isOptOut,
  })

  if (nameOwner) {
    await WorldModel.upsertWorld({
      world_name: worldName,
      owner: nameOwner,
    })
  }

  const placeOptions = {
    url: contentServerUrl,
    creator,
    sdk,
    worldId,
    deploymentId,
  }

  if (overlappingPlaces.length === 1) {
    const existingPlace = overlappingPlaces[0]
    const place = createPlaceFromContentEntityScene(
      contentEntityScene,
      existingPlace,
      placeOptions
    )
    const rating =
      place.content_rating !== existingPlace.content_rating
        ? {
            id: randomUUID(),
            entity_id: existingPlace.id,
            original_rating: existingPlace.content_rating,
            update_rating: place.content_rating,
            moderator: null,
            comment: null,
            created_at: new Date(),
          }
        : null

    applyOptOut(place, isOptOut)
    return {
      kind: "world",
      placesToProcess: { update: place, rating, disabled: [] },
      replacement: {
        candidates: [],
        includesTimestampTies: false,
        updatedPlace: existingPlace,
      },
      positionWatermark,
    }
  }

  const place = createPlaceFromContentEntityScene(
    contentEntityScene,
    {},
    placeOptions
  )
  applyOptOut(place, isOptOut)
  return {
    kind: "world",
    placesToProcess: {
      new: place,
      rating: {
        id: randomUUID(),
        entity_id: place.id,
        original_rating: null,
        update_rating: place.content_rating,
        moderator: null,
        comment: null,
        created_at: new Date(),
      },
      disabled: overlappingPlaces,
    },
    replacement: {
      candidates: overlappingPlaces,
      includesTimestampTies: true,
      updatedPlace: null,
    },
    positionWatermark,
  }
}

function applyOptOut(place: PlaceAttributes, isOptOut: boolean): void {
  if (isOptOut) {
    place.disabled = true
    place.disabled_reason = DisabledReason.OPT_OUT
    place.disabled_at = place.disabled_at || new Date()
    return
  }

  place.disabled = false
  place.disabled_reason = null
  place.disabled_at = null
}
