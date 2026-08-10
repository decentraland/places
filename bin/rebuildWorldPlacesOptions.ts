import type { PlaceAttributes } from "../src/entities/Place/types"

export const REBUILD_PLACE_ATTRIBUTES: Array<keyof PlaceAttributes> = [
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

export function createWorldPlaceOptions(
  deploymentId: string,
  url: string,
  creator: string | null,
  sdk: string | null,
  worldId: string
) {
  return { deploymentId, url, creator, sdk, worldId }
}
