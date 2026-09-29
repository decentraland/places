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
  servedUpstreamIds?: string[]
  worldName: string
}

export type WorldDeploymentVerifyUpstream = {
  kind: "verify-upstream"
  base: string
}

/**
 * Resolve a world deployment into the place mutation and durable replacement intents that the
 * task runner must apply. The caller owns the surrounding database transaction; this helper owns
 * the per-world lock and guarantees no world row is written for a superseded deployment.
 *
 * @param options.servedUpstreamIds - deployment ids the content server currently serves at the
 * scene base. Omit on the first call: a watermark match then returns `verify-upstream` so the caller
 * can fetch them outside the transaction and call again with them, which always yields a decision.
 * A newer real place or a tombstone of this deployment id supersedes without a fetch; a redelivery
 * of the active deployment skips the checks.
 */
export function resolveWorldDeployment(
  options: ResolveWorldDeploymentOptions & { servedUpstreamIds: string[] }
): Promise<WorldDeploymentDecision>
export function resolveWorldDeployment(
  options: ResolveWorldDeploymentOptions
): Promise<WorldDeploymentDecision | WorldDeploymentVerifyUpstream>
export async function resolveWorldDeployment({
  contentEntityScene,
  contentServerUrl,
  creator,
  deploymentId,
  nameOwner,
  sdk,
  servedUpstreamIds,
  worldName,
}: ResolveWorldDeploymentOptions): Promise<
  WorldDeploymentDecision | WorldDeploymentVerifyUpstream
> {
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
  const [
    worldUndeployment,
    sceneUndeployment,
    hasNewerPositionWatermark,
    isTombstonedByIdentity,
  ] = await Promise.all([
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
    WorldSceneUndeploymentModel.hasSupersedingIdentity(
      worldId,
      deploymentId,
      deployedAt
    ),
  ])
  const supersededDecision: WorldDeploymentDecision = {
    kind: "world",
    placesToProcess: null,
    replacement: {
      candidates: overlappingPlaces,
      includesTimestampTies: false,
      updatedPlace: null,
    },
    positionWatermark,
  }
  const isAlreadyActive = overlappingPlaces.some(
    (place) => place.deployment_id === deploymentId
  )

  if (!isAlreadyActive) {
    if (hasNewerPlace || isTombstonedByIdentity) {
      return supersededDecision
    }

    const isSupersededByWatermark = !!(
      worldUndeployment ||
      sceneUndeployment ||
      hasNewerPositionWatermark
    )
    if (isSupersededByWatermark) {
      if (servedUpstreamIds === undefined) {
        return { kind: "verify-upstream", base: scene.base }
      }
      if (!servedUpstreamIds.includes(deploymentId)) {
        return supersededDecision
      }
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
