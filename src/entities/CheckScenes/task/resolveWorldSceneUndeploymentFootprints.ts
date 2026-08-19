import { WorldScenesUndeploymentEvent } from "@dcl/schemas/dist/platform/events/world"
import env from "decentraland-gatsby/dist/utils/env"

import { InvalidWorldSqsMessageError } from "./errors"
import {
  fetchContentEntity,
  getTrustedWorldsContentServerUrl,
} from "./processEntityId"
import { UndeployedScene } from "../../WorldSceneUndeployment/types"

const FOOTPRINT_FETCH_CONCURRENCY = 10
const PARCEL_PATTERN = /^(?:0|-?[1-9][0-9]*),(?:0|-?[1-9][0-9]*)$/

export type ResolvedUndeployedScene = UndeployedScene & {
  parcels: string[]
  /**
   * The undeployed entity's own deployment timestamp, when the immutable entity was fetched.
   * Null for events that carry their footprint inline, which is the case the fetch avoids.
   */
  deployedAt: number | null
}

function validateFootprint(
  entityId: string,
  baseParcel: string,
  parcels: string[]
): string[] {
  const uniqueParcels = [...new Set(parcels)]
  if (
    uniqueParcels.length === 0 ||
    !uniqueParcels.every((parcel) => PARCEL_PATTERN.test(parcel)) ||
    !uniqueParcels.includes(baseParcel)
  ) {
    throw new InvalidWorldSqsMessageError(
      `Scene undeployment footprint for '${entityId}' must contain its canonical base parcel '${baseParcel}'.`
    )
  }
  return uniqueParcels
}

async function resolveScene(
  scene: WorldScenesUndeploymentEvent["metadata"]["scenes"][number],
  contentServerUrl: string
): Promise<ResolvedUndeployedScene> {
  if (scene.parcels?.length) {
    return {
      entityId: scene.entityId,
      baseParcel: scene.baseParcel,
      parcels: validateFootprint(
        scene.entityId,
        scene.baseParcel,
        scene.parcels
      ),
      deployedAt: null,
    }
  }

  const entity = await fetchContentEntity(scene.entityId, contentServerUrl)
  if (!entity) {
    throw new InvalidWorldSqsMessageError(
      `Undeployed content '${scene.entityId}' is not a scene entity.`
    )
  }
  return {
    entityId: scene.entityId,
    baseParcel: scene.baseParcel,
    parcels: validateFootprint(
      scene.entityId,
      scene.baseParcel,
      entity.pointers
    ),
    deployedAt: entity.timestamp,
  }
}

/**
 * Resolve complete footprints for a scene undeployment without holding a database transaction.
 * New events carry parcels inline; legacy and SNS-trimmed entries fetch the immutable entity from
 * Worlds Content Server. Fetches are bounded so large legacy batches do not create an HTTP spike.
 */
export async function resolveWorldSceneUndeploymentFootprints(
  scenes: WorldScenesUndeploymentEvent["metadata"]["scenes"],
  worldsContentServerUrl = env(
    "WORLDS_CONTENT_SERVER_URL",
    "https://worlds-content-server.decentraland.org"
  ),
  allowedContentServerHosts = env("ALLOWED_CONTENT_SERVER_HOSTS", "")
): Promise<ResolvedUndeployedScene[]> {
  const needsFetch = scenes.some((scene) => !scene.parcels?.length)
  const contentServerUrl = needsFetch
    ? getTrustedWorldsContentServerUrl(
        worldsContentServerUrl,
        allowedContentServerHosts
      )
    : ""
  const resolved: ResolvedUndeployedScene[] = []
  for (
    let index = 0;
    index < scenes.length;
    index += FOOTPRINT_FETCH_CONCURRENCY
  ) {
    const batch = scenes.slice(index, index + FOOTPRINT_FETCH_CONCURRENCY)
    resolved.push(
      ...(await Promise.all(
        batch.map((scene) => resolveScene(scene, contentServerUrl))
      ))
    )
  }
  return resolved
}
