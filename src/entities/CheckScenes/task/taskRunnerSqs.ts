import { randomUUID } from "crypto"

import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { DeploymentToSqs } from "./consumer"
import { extractSceneJsonData } from "./extractSceneJsonData"
import {
  ProcessEntitySceneResult,
  assertSceneBaseIsAuthorized,
  createPlaceFromContentEntityScene,
  processContentEntityScene,
} from "./processContentEntityScene"
import { getTrustedContentServerUrl, processEntityId } from "./processEntityId"
import CategoryModel from "../../Category/model"
import { DecentralandCategories } from "../../Category/types"
import { withDatabaseTransaction } from "../../Database/model"
import PlaceModel from "../../Place/model"
import { DisabledReason, PlaceAttributes } from "../../Place/types"
import { sanitizePlaceDescription } from "../../Place/utils"
import PlaceCategories from "../../PlaceCategories/model"
import PlaceContentRatingModel from "../../PlaceContentRating/model"
import PlacePositionModel from "../../PlacePosition/model"
import {
  notifyDisablePlaces,
  notifyNewPlace,
  notifyUpdatePlace,
} from "../../Slack/utils"
import WorldModel from "../../World/model"
import WorldDeploymentPositionWatermarkModel from "../../WorldDeploymentPositionWatermark/model"
import WorldSceneUndeploymentModel from "../../WorldSceneUndeployment/model"
import WorldUndeploymentModel from "../../WorldUndeployment/model"
import CheckScenesModel from "../model"
import { CheckSceneLogsTypes } from "../types"
import { fetchNameOwner, updateGenesisCityManifest } from "../utils"

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

export async function taskRunnerSqs(job: DeploymentToSqs) {
  const contentServerUrl = getTrustedContentServerUrl(job)
  const contentEntityScene = await processEntityId(job)

  if (!contentEntityScene) {
    return null
  }

  assertSceneBaseIsAuthorized(contentEntityScene)

  // Extract creator address and SDK version from scene.json. Fall back to
  // entity metadata when the secondary blob fetch fails or returns nulls —
  // metadata is the same scene.json already parsed by the content server, so
  // it's the authoritative source even when the standalone fetch hiccups
  // (CDN replication lag, transient network errors, etc).
  const sceneJsonData = await extractSceneJsonData(
    contentEntityScene,
    contentServerUrl
  )
  const creator =
    sceneJsonData.creator ||
    (contentEntityScene.metadata as { creator?: string } | undefined)
      ?.creator ||
    null
  const sdk =
    sceneJsonData.runtimeVersion ||
    (contentEntityScene.metadata as { runtimeVersion?: string } | undefined)
      ?.runtimeVersion ||
    null

  const worldConfiguration = contentEntityScene.metadata.worldConfiguration
  if (
    worldConfiguration &&
    !(worldConfiguration.name || worldConfiguration.dclName)
  ) {
    throw new Error("worldConfiguration without name")
  }
  const worldName = worldConfiguration
    ? ((worldConfiguration.name || worldConfiguration.dclName) as string)
    : null
  const nameOwner = worldName ? await fetchNameOwner(worldName) : null

  if (worldConfiguration && !contentEntityScene.metadata.owner && nameOwner) {
    contentEntityScene.metadata.owner = nameOwner
  }

  const processedPlaces = await withDatabaseTransaction(async () => {
    let placesToProcess: ProcessEntitySceneResult | null = null
    // Candidates this deployment replaced upstream. PostgreSQL applies the timestamp cutoff and
    // returns the rows actually disabled so logs and durable removal records match database state.
    let replacementCandidates: PlaceAttributes[] = []
    let replacementIncludesTies = false
    let updatedPlaceReplacement: PlaceAttributes | null = null

    if (worldConfiguration && worldName) {
      // Serialize deployments for this world so overlap resolution can't interleave
      await WorldModel.lockWorldForDeployment(worldName)

      // Determine if opt-out is set
      const isOptOut =
        !!contentEntityScene?.metadata?.worldConfiguration?.placesConfig?.optOut

      // A worlds row id is the normalized world name, so every lookup below resolves
      // before the row exists. Nothing may write to `worlds` until this deployment is
      // known to be applicable: that row is served by GET /api/worlds/:world_id without
      // requiring an enabled place, so inserting it first would publish a world built
      // from a deployment that is about to be rejected.
      const worldId = worldName.toLowerCase()

      // World-specific overlap logic: in worlds, positions can change freely
      // between deployments, so identity is based on overlap count rather than
      // exact position matching (which is what Genesis City uses).
      //  - 0 overlapping → new scene in this world
      //  - 1 overlapping → same scene, possibly reshaped → update
      //  - 2+ overlapping → new scene supersedes multiple old ones → create + disable
      const overlappingPlaces =
        await PlaceModel.findActiveByWorldIdAndPositions(
          worldId,
          contentEntityScene.pointers
        )

      const options = {
        url: contentServerUrl,
        creator,
        sdk,
        worldId,
        deploymentId: job.entity.entityId,
      }

      // Stale deployment protection: PostgreSQL must compare these timestamp-without-time-zone
      // values so the result does not depend on the Node process timezone.
      const hasNewerPlace = await PlaceModel.hasNewerActiveWorldDeployment(
        worldId,
        contentEntityScene.pointers,
        new Date(contentEntityScene.timestamp)
      )

      // Undeployment watermarks outlive the disabled rows, so a deployment delivered after the
      // undeployment that supersedes it cannot recreate the scene
      const deployedAt = new Date(contentEntityScene.timestamp)
      const [worldUndeployment, sceneUndeployment, hasNewerPositionWatermark] =
        await Promise.all([
          WorldUndeploymentModel.findSupersedingUndeployment(
            worldId,
            deployedAt
          ),
          WorldSceneUndeploymentModel.findSupersedingUndeployment(
            worldId,
            job.entity.entityId,
            contentEntityScene.metadata.scene!.base,
            deployedAt
          ),
          WorldDeploymentPositionWatermarkModel.hasSupersedingDeployment(
            worldId,
            contentEntityScene.pointers,
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
        // This deployment is superseded, so it contributes no place and must not touch
        // the worlds row. Its removals are not superseded though: a deployment that
        // committed upstream marked every scene overlapping its footprint as UNDEPLOYED,
        // and the worlds content server publishes scene undeployment events only for
        // explicit deletes, never for replacement by deployment. Nothing else will ever
        // report those removals, so disable the overlaps this deployment replaced
        // instead of leaving them as places pointing at scenes that no longer exist.
        //
        // Only strictly older overlaps: anything deployed at or after this deployment
        // survived it upstream, or replaced it in turn.
        placesToProcess = null
        replacementCandidates = overlappingPlaces
        replacementIncludesTies = false
      } else {
        // Resolve the on-chain name owner. This is the authoritative owner for
        // the world record, while the place uses metadata.owner as primary and
        // falls back to the name owner.
        // Insert the world if it doesn't exist yet. The world owner is always
        // the on-chain name owner, not the deployment metadata owner.
        await WorldModel.insertWorldIfNotExists({
          world_name: worldName,
          title:
            contentEntityScene?.metadata?.display?.title?.slice(0, 50) ||
            undefined,
          description:
            sanitizePlaceDescription(
              contentEntityScene?.metadata?.display?.description
            ) || undefined,
          content_rating:
            (contentEntityScene?.metadata?.policy
              ?.contentRating as SceneContentRating) || undefined,
          categories: contentEntityScene?.metadata?.tags || undefined,
          owner: nameOwner || undefined,
          show_in_places: !isOptOut,
        })

        // Update the world owner on every deployment to keep it in sync with
        // the current on-chain name ownership.
        if (nameOwner) {
          await WorldModel.upsertWorld({
            world_name: worldName,
            owner: nameOwner,
          })
        }

        if (overlappingPlaces.length === 1) {
          // Single overlap → update that place (same scene, possibly reshaped)
          const existingPlace = overlappingPlaces[0]
          const place = createPlaceFromContentEntityScene(
            contentEntityScene,
            existingPlace,
            options
          )

          let rating = null
          if (place.content_rating !== existingPlace.content_rating) {
            rating = {
              id: randomUUID(),
              entity_id: existingPlace.id,
              original_rating: existingPlace.content_rating,
              update_rating: place.content_rating,
              moderator: null,
              comment: null,
              created_at: new Date(),
            }
          }

          placesToProcess = { update: place, rating, disabled: [] }
          updatedPlaceReplacement = existingPlace
        } else {
          // 0 or 2+ overlapping → create a new place, disable all overlapping
          const place = createPlaceFromContentEntityScene(
            contentEntityScene,
            {},
            options
          )

          placesToProcess = {
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
          }
          replacementCandidates = overlappingPlaces
          replacementIncludesTies = true
        }
      }

      // Apply opt-out override on top of the standard result
      if (placesToProcess) {
        const place = placesToProcess.new || placesToProcess.update
        if (isOptOut) {
          place.disabled = true
          place.disabled_reason = DisabledReason.OPT_OUT
          place.disabled_at = place.disabled_at || new Date()
        } else {
          place.disabled = false
          place.disabled_reason = null
          place.disabled_at = null
        }
      }
    } else {
      const places = await PlaceModel.findEnabledByPositions(
        contentEntityScene.pointers
      )
      placesToProcess = processContentEntityScene(contentEntityScene, places, {
        url: contentServerUrl,
        creator,
        sdk,
        deploymentId: job.entity.entityId,
      })
    }

    if (placesToProcess?.new) {
      await PlaceModel.insertPlace(placesToProcess.new, placesAttributes)
      await Promise.all([
        !contentEntityScene.metadata.worldConfiguration &&
          PlacePositionModel.syncBasePosition(placesToProcess.new),
        overridePlaceCategories(
          placesToProcess.new.id,
          contentEntityScene.metadata.tags || []
        ),
        CheckScenesModel.createOne({
          entity_id: job.entity.entityId,
          content_server_url: contentServerUrl,
          base_position: contentEntityScene.metadata.scene!.base,
          positions: contentEntityScene.metadata.scene!.parcels,
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

      // No row matched: the stored place already holds a newer revision, discard this one
      if (updatedPlaces === 0) {
        placesToProcess = null
        updatedPlaceReplacement = null
      } else {
        await Promise.all([
          !contentEntityScene.metadata.worldConfiguration &&
            PlacePositionModel.syncBasePosition(placesToProcess.update),
          overridePlaceCategories(
            placesToProcess.update.id,
            contentEntityScene.metadata.tags || []
          ),
          CheckScenesModel.createOne({
            entity_id: job.entity.entityId,
            content_server_url: contentServerUrl,
            base_position: contentEntityScene.metadata.scene!.base,
            positions: contentEntityScene.metadata.scene!.parcels,
            action: CheckSceneLogsTypes.UPDATE,
            deploy_at: new Date(contentEntityScene.timestamp),
          }),
        ])

        if (updatedPlaceReplacement && worldName) {
          await recordReplacementRemovals(
            worldName,
            [updatedPlaceReplacement],
            contentEntityScene.timestamp
          )
        }
      }
    }

    if (!placesToProcess) {
      await CheckScenesModel.createOne({
        entity_id: job.entity.entityId,
        content_server_url: contentServerUrl,
        base_position: contentEntityScene.metadata.scene!.base,
        positions: contentEntityScene.metadata.scene!.parcels,
        action: CheckSceneLogsTypes.AVOID,
        deploy_at: new Date(contentEntityScene.timestamp),
      })
    }

    let placesToDisable: PlaceAttributes[]
    if (worldConfiguration) {
      // World replacements use PostgreSQL timestamp ordering and persist durable tombstones.
      placesToDisable = await PlaceModel.disableReplacedWorldPlaces(
        replacementCandidates.map((place) => place.id),
        new Date(contentEntityScene.timestamp),
        replacementIncludesTies
      )
      if (placesToProcess) {
        placesToProcess.disabled = placesToDisable
      }
      if (placesToDisable.length > 0 && worldName) {
        await recordReplacementRemovals(
          worldName,
          placesToDisable,
          contentEntityScene.timestamp
        )
      }
    } else {
      // Genesis City keeps its established overlap resolution. These rows have no world
      // replacement watermark and were already filtered by processContentEntityScene().
      placesToDisable = placesToProcess?.disabled ?? []
      if (placesToDisable.length > 0) {
        await PlaceModel.disablePlaces(placesToDisable.map((place) => place.id))
      }
    }

    // A valid deployment event proves this footprint committed upstream even when Places must
    // avoid the deployment because newer state arrived first. Persist its replacement boundary
    // so an older overlapping deployment that has never had a place row cannot arrive later and
    // resurrect content retired by this deployment.
    if (worldName) {
      await WorldDeploymentPositionWatermarkModel.recordPositions(
        worldName,
        contentEntityScene.pointers,
        new Date(contentEntityScene.timestamp)
      )
    }

    await Promise.all([
      placesToProcess?.rating &&
        PlaceContentRatingModel.createOne(placesToProcess.rating),
      placesToDisable.length &&
        (async () => {
          const positions = new Set(
            placesToDisable.flatMap((place) => place.positions)
          )
          placesToProcess?.new?.positions.forEach((position) =>
            positions.delete(position)
          )
          placesToProcess?.update?.positions.forEach((position) =>
            positions.delete(position)
          )
          await Promise.all([
            !contentEntityScene.metadata.worldConfiguration &&
              PlacePositionModel.removePositions([...positions]),
            CheckScenesModel.createMany(
              placesToDisable.map((place) => ({
                entity_id: job.entity.entityId,
                content_server_url: contentServerUrl,
                base_position: place.base_position,
                positions: place.positions,
                action: CheckSceneLogsTypes.DISABLED,
              }))
            ),
          ])
        })(),
    ])
    return { placesToProcess, placesToDisable }
  })

  const { placesToProcess, placesToDisable } = processedPlaces

  if (placesToProcess?.new) notifyNewPlace(placesToProcess.new, job)
  if (placesToProcess?.update) notifyUpdatePlace(placesToProcess.update, job)
  if (placesToDisable.length) notifyDisablePlaces(placesToDisable)

  void Promise.resolve(updateGenesisCityManifest()).catch(() => undefined)
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
