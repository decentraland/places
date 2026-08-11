import { WorldScenesUndeploymentEvent } from "@dcl/schemas/dist/platform/events/world"

const PARCEL_PATTERN = /^(?:0|-?[1-9][0-9]*),(?:0|-?[1-9][0-9]*)$/

type WorldSceneUndeploymentEntry =
  WorldScenesUndeploymentEvent["metadata"]["scenes"][number] & {
    parcels?: string[] | null
  }

export type WorldScenesUndeploymentEventWithParcels = Omit<
  WorldScenesUndeploymentEvent,
  "metadata"
> & {
  metadata: Omit<WorldScenesUndeploymentEvent["metadata"], "scenes"> & {
    scenes: WorldSceneUndeploymentEntry[]
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasValidOptionalParcels(scene: Record<string, unknown>): boolean {
  if (!("parcels" in scene) || scene.parcels === null) {
    return true
  }
  if (!Array.isArray(scene.parcels) || scene.parcels.length === 0) {
    return false
  }
  if (
    !scene.parcels.every(
      (parcel): parcel is string =>
        typeof parcel === "string" && PARCEL_PATTERN.test(parcel)
    )
  ) {
    return false
  }
  return new Set(scene.parcels).size === scene.parcels.length
}

/**
 * Validates the optional parcel footprint introduced after schemas v27 while retaining the
 * authoritative v27 validation for the rest of the event. This compatibility layer can be
 * removed after Places updates to the schemas release containing the optional field.
 */
export function isWorldScenesUndeploymentEventWithParcels(
  message: unknown
): message is WorldScenesUndeploymentEventWithParcels {
  if (!isRecord(message) || !isRecord(message.metadata)) {
    return false
  }
  const rawScenes = message.metadata.scenes
  if (!Array.isArray(rawScenes)) {
    return false
  }

  const identityScenes: Array<Record<string, unknown>> = []
  for (const scene of rawScenes) {
    if (!isRecord(scene)) {
      return false
    }
    const keys = Object.keys(scene)
    if (
      keys.some(
        (key) => !["entityId", "baseParcel", "parcels"].includes(key)
      ) ||
      !hasValidOptionalParcels(scene)
    ) {
      return false
    }
    identityScenes.push({
      entityId: scene.entityId,
      baseParcel: scene.baseParcel,
    })
  }

  const identityOnlyEvent = {
    ...message,
    metadata: {
      ...message.metadata,
      scenes: identityScenes,
    },
  }
  return WorldScenesUndeploymentEvent.validate(identityOnlyEvent)
}
