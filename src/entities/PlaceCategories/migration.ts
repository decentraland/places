import { SQL } from "decentraland-gatsby/dist/entities/Database/utils"

import PlaceCategories from "./model"

export class PoiCaptureError extends Error {
  constructor() {
    super("POI capture is unavailable; the job must stop without fallback")
    this.name = "PoiCaptureError"
  }
}

/** Only the opted-in POI job calls this source-local atomic mutation/outbox function. */
export async function applyCapturedPoiMembership(
  entityId: string,
  poi: boolean
): Promise<void> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      entityId
    ) ||
    entityId === "00000000-0000-0000-0000-000000000000"
  ) {
    throw new PoiCaptureError()
  }
  try {
    await PlaceCategories.namedQuery(
      "apply_captured_poi_membership",
      SQL`SELECT migration_capture.apply_poi_membership(${entityId}::uuid, ${poi}::boolean)`
    )
  } catch {
    // Never fall back to an unrecorded write after uncertain source completion.
    throw new PoiCaptureError()
  }
}
