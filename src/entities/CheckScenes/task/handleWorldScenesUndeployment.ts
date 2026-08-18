import { WorldScenesUndeploymentEvent } from "@dcl/schemas/dist/platform/events/world"
import logger from "decentraland-gatsby/dist/entities/Development/logger"
import env from "decentraland-gatsby/dist/utils/env"

import { InvalidWorldSqsMessageError } from "./errors"
import { fetchWorldActiveScenesAtPositions } from "./fetchWorldActiveScenes"
import {
  fetchContentEntity,
  getTrustedWorldsContentServerUrl,
} from "./processEntityId"
import {
  ResolvedUndeployedScene,
  resolveWorldSceneUndeploymentFootprints,
} from "./resolveWorldSceneUndeploymentFootprints"
import { withDatabaseTransaction } from "../../Database/model"
import PlaceModel from "../../Place/model"
import { notifyError } from "../../Slack/utils"
import WorldModel from "../../World/model"
import WorldDeploymentPositionWatermarkModel from "../../WorldDeploymentPositionWatermark/model"
import WorldSceneUndeploymentModel from "../../WorldSceneUndeployment/model"
import { UndeployedScene } from "../../WorldSceneUndeployment/types"

const LOGGED_BASE_POSITIONS_LIMIT = 20

function deduplicateScenes(scenes: UndeployedScene[]): UndeployedScene[] {
  const uniqueScenes = new Map<string, UndeployedScene>()
  for (const scene of scenes) {
    const existing = uniqueScenes.get(scene.entityId)
    if (existing && existing.baseParcel !== scene.baseParcel) {
      throw new InvalidWorldSqsMessageError(
        `Scene undeployment repeats deployment '${scene.entityId}' with conflicting base parcels.`
      )
    }
    if (existing?.parcels?.length && scene.parcels?.length) {
      const existingParcels = [...existing.parcels].sort()
      const incomingParcels = [...scene.parcels].sort()
      if (JSON.stringify(existingParcels) !== JSON.stringify(incomingParcels)) {
        throw new InvalidWorldSqsMessageError(
          `Scene undeployment repeats deployment '${scene.entityId}' with conflicting footprints.`
        )
      }
    }
    if (!existing?.parcels?.length || scene.parcels?.length) {
      uniqueScenes.set(scene.entityId, scene)
    }
  }
  return [...uniqueScenes.values()]
}

function summarizeBasePositions(basePositions: string[]): string {
  const shown = basePositions.slice(0, LOGGED_BASE_POSITIONS_LIMIT).join(", ")
  const remaining = basePositions.length - LOGGED_BASE_POSITIONS_LIMIT
  return remaining > 0 ? `${shown} (+${remaining} more)` : shown
}

/**
 * Handles WorldScenesUndeploymentEvent from the worlds content server.
 *
 * A place id is a local catalog UUID that may be preserved across redeployments so favorites,
 * moderation and other product state remain attached to the logical place. The worlds content
 * server neither owns nor knows that UUID. Its entity id instead identifies the exact immutable
 * deployment that produced the event, which is what the disabling statement matches on first. It
 * also retires the older revisions that removed content had replaced upstream, by footprint and by
 * base position, because those revisions are gone even when their own removal never reached Places.
 *
 * Those wider matches cannot be bounded by the event's timestamp: it marks when the removal was
 * emitted, which is always after the entity timestamp of the deployment that caused it, so a
 * replacement looks older than the removal of what it replaced and sits at the same base and
 * parcels. The scenes the world still serves are therefore read from the content server and left
 * alone, both in the place rows and in the watermarks that decide whether a later delivery of one
 * of those deployments is accepted.
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

  const uniqueScenes = deduplicateScenes(scenes)
  const loggerExtended = logger.extend({
    worldName,
    sceneCount: uniqueScenes.length,
    eventType: "WorldScenesUndeploymentEvent",
  })

  try {
    const resolvedScenes = await resolveWorldSceneUndeploymentFootprints(
      uniqueScenes
    )

    // Only the parcels this event claims to have cleared can hold a place row it would disable, so
    // the upstream lookup is scoped to them rather than to the whole world.
    const clearedPositions = [
      ...new Set(resolvedScenes.flatMap((scene) => scene.parcels)),
    ]
    const activeScenes = await fetchWorldActiveScenesAtPositions(
      worldName,
      clearedPositions
    )

    const liveDeploymentIds = new Set(activeScenes.deploymentIds)
    const livePositions = new Set(activeScenes.positions)

    // An event naming a deployment the world still serves contradicts upstream state: a later
    // redeployment of the same content is the ordinary cause, and acting on it would remove a
    // scene players can still visit.
    const undeployedScenes = resolvedScenes.filter(
      (scene) => !liveDeploymentIds.has(scene.entityId)
    )
    const stillServed = resolvedScenes.length - undeployedScenes.length

    if (stillServed > 0) {
      loggerExtended.log(
        `WARNING: skipped ${stillServed} undeployed scenes that ${worldName} still serves`
      )
    }

    if (undeployedScenes.length === 0) {
      loggerExtended.log(
        `Every scene in the undeployment for world: ${worldName} is still served; nothing to disable`
      )
      return
    }

    const basePositions = undeployedScenes.map((scene) => scene.baseParcel)
    const deploymentIds = undeployedScenes.map((scene) => scene.entityId)
    const positions = [
      ...new Set(undeployedScenes.flatMap((scene) => scene.parcels)),
    ]
    const basePositionsSummary = summarizeBasePositions(basePositions)

    loggerExtended.log(
      `Processing scene undeployment for world: ${worldName}, parcels: ${basePositionsSummary}`
    )

    // Same lock the deployment path takes, so an in-flight deployment for this world cannot
    // commit an enabled place this event would have disabled
    const undeployedAt = await resolveUndeployedAt(
      worldName,
      undeployedScenes,
      event.timestamp
    )

    const result = await withDatabaseTransaction(async () => {
      await WorldModel.lockWorldForDeployment(worldName)

      // Durable watermark: the undeployment can arrive before the deployment it refers to, so
      // record it whether or not a place row matched
      await WorldSceneUndeploymentModel.recordScenes(
        worldName,
        undeployedScenes.map((scene) => ({
          entityId: scene.entityId,
          baseParcel: scene.baseParcel,
          parcels: scene.parcels,
          undeployedAt: undeployedAt.get(scene.entityId)!,
        }))
      )
      await recordClearedPositions(
        worldName,
        undeployedScenes,
        livePositions,
        event.timestamp
      )

      return PlaceModel.disableByWorldIdAndDeployments(
        worldName,
        deploymentIds,
        basePositions,
        positions,
        event.timestamp,
        activeScenes.deploymentIds,
        activeScenes.positions
      )
    })

    if (result.legacyBaseMatches > 0) {
      loggerExtended.log(
        `WARNING: disabled ${result.legacyBaseMatches} legacy place records without deployment ids; replay world deployments to reconcile them`
      )
    }

    loggerExtended.log(
      `Disabled place records for world: ${worldName} at positions: ${basePositionsSummary}`
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

/**
 * Pair each undeployed scene with the deployment timestamp of the content that was removed, so the
 * watermarks reject what that content superseded instead of everything older than the removal.
 *
 * The emission time is never used as a substitute. Rejection matches a scene's base parcel as well
 * as its identity, so a watermark stamped later than the removed content tombstones that base past
 * the deployment now serving it: the next delivery for that base is judged superseded, and the
 * superseded path then disables the live place as replaced. Places usually knows the timestamp
 * already, but a replacement overwrites the deployment id on the row it reuses, so the removed
 * content's own entity is the fallback rather than the clock.
 */
async function resolveUndeployedAt(
  worldName: string,
  undeployedScenes: ResolvedUndeployedScene[],
  eventTimestamp: number
): Promise<Map<string, Date>> {
  const unknown = undeployedScenes
    .filter((scene) => scene.deployedAt === null)
    .map((scene) => scene.entityId)
  const storedDeployedAt = await PlaceModel.findDeployedAtByDeploymentIds(
    worldName,
    unknown
  )

  let contentServerUrl: string | null = null
  const resolved = new Map<string, Date>()

  for (const scene of undeployedScenes) {
    let deployedAt =
      scene.deployedAt !== null
        ? new Date(scene.deployedAt)
        : storedDeployedAt.get(scene.entityId) ?? null

    if (!deployedAt) {
      contentServerUrl =
        contentServerUrl ??
        getTrustedWorldsContentServerUrl(
          env(
            "WORLDS_CONTENT_SERVER_URL",
            "https://worlds-content-server.decentraland.org"
          ),
          env("ALLOWED_CONTENT_SERVER_HOSTS", "")
        )
      const entity = await fetchContentEntity(scene.entityId, contentServerUrl)
      if (!entity) {
        throw new InvalidWorldSqsMessageError(
          `Undeployed content '${scene.entityId}' is not a scene entity.`
        )
      }
      deployedAt = new Date(entity.timestamp)
    }

    // Content cannot be removed before it was deployed, so a timestamp past the event is not the
    // removed content's; clamp rather than carry it into a watermark.
    resolved.set(
      scene.entityId,
      deployedAt.getTime() > eventTimestamp
        ? new Date(eventTimestamp)
        : deployedAt
    )
  }

  return resolved
}

/**
 * Watermark the parcels the undeployment cleared, as of the moment it was emitted.
 *
 * Parcels a surviving scene occupies are left out, and the upstream lookup covers exactly these
 * parcels, so every parcel that remains has nothing serving it. The emission time is therefore both
 * safe and the strongest bound available: no surviving deployment can be rejected by it, and it
 * retires every revision the cleared parcels ever held rather than only those older than the last
 * one Places happened to see.
 */
async function recordClearedPositions(
  worldName: string,
  undeployedScenes: ResolvedUndeployedScene[],
  livePositions: Set<string>,
  eventTimestamp: number
): Promise<void> {
  const cleared = [
    ...new Set(
      undeployedScenes
        .flatMap((scene) => scene.parcels)
        .filter((parcel) => !livePositions.has(parcel))
    ),
  ]

  await WorldDeploymentPositionWatermarkModel.recordPositions(
    worldName,
    cleared,
    new Date(eventTimestamp),
    true
  )
}
