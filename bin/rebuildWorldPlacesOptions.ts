import {
  ContentEntityScene,
  SceneContentRating,
} from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { sanitizePlaceDescription } from "../src/entities/Place/utils"

import type { PlaceAttributes } from "../src/entities/Place/types"
import type { WorldAttributes } from "../src/entities/World/types"

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

/**
 * Build the world row a rebuild stores, mirroring the SQS path in resolveWorldDeployment:
 * creator-authored text is sanitized before it reaches the database.
 */
export function createWorldInsertData(
  worldName: string,
  contentEntityScene: ContentEntityScene,
  nameOwner: string | undefined,
  isOptOut: boolean
): Partial<WorldAttributes> & { world_name: string } {
  return {
    world_name: worldName,
    title:
      contentEntityScene?.metadata?.display?.title?.slice(0, 50) || undefined,
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
  }
}

export function createWorldPlaceOptions(
  deploymentId: string,
  url: string,
  creator: string | null,
  sdk: string | null,
  worldId: string
) {
  return { deploymentId, url, creator, sdk, worldId }
}
