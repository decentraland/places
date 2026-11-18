import { v5 } from "uuid"

import { InvalidWorldSqsMessageError } from "./errors"

/** Shared with dcl-one: only mint when the place lifecycle requires a new identity. */
export function createPlaceIdentity(
  entityId: string | null | undefined,
  worldName: string | null
): string {
  if (!entityId || entityId.trim() !== entityId) {
    throw new InvalidWorldSqsMessageError(
      "A verified immutable deployment entity ID is required to create a place"
    )
  }
  if (worldName !== null && (!worldName || worldName.trim() !== worldName)) {
    throw new InvalidWorldSqsMessageError("A canonical world name is required")
  }
  const scope = worldName ? `world:${worldName.toLowerCase()}` : "genesis"
  return v5(
    JSON.stringify(["decentraland-place", "v1", scope, entityId]),
    v5.URL
  )
}
