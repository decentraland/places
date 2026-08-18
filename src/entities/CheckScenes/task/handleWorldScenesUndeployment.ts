import { WorldScenesUndeploymentEvent } from "@dcl/schemas/dist/platform/events/world"
import logger from "decentraland-gatsby/dist/entities/Development/logger"

import { InvalidWorldSqsMessageError } from "./errors"
import { fetchWorldActiveScenesAtPositions } from "./fetchWorldActiveScenes"
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
 * alone -- in the place rows, in the base parcels the scene watermark claims, and in the parcels the
 * position watermark clears.
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
    const result = await withDatabaseTransaction(async () => {
      await WorldModel.lockWorldForDeployment(worldName)

      // Durable watermark: the undeployment can arrive before the deployment it refers to, so
      // record it whether or not a place row matched.
      //
      // Rejection matches a scene's base parcel as well as its identity, so a row for a base that
      // something still serves would tombstone that base as of this removal and reject the very
      // deployment serving it. Those are left out: the live place row already rejects older
      // revisions at that base, and its own removal will record the base when it happens.
      await WorldSceneUndeploymentModel.recordScenes(
        worldName,
        undeployedScenes
          .filter((scene) => !livePositions.has(scene.baseParcel))
          .map((scene) => ({
            entityId: scene.entityId,
            baseParcel: scene.baseParcel,
            parcels: scene.parcels,
            undeployedAt: new Date(event.timestamp),
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
