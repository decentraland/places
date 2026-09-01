import { randomUUID } from "crypto"

import { SceneParcels } from "@dcl/schemas"
import {
  ContentEntityScene,
  SceneContentRating,
} from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { InvalidSceneBaseError } from "./errors"
import getContentRating, {
  isDowngradingRating,
  isUpgradingRating,
} from "../../../utils/rating/contentRating"
import PlaceModel from "../../Place/model"
import { PlaceAttributes } from "../../Place/types"
import {
  getThumbnailFromContentDeployment as getThumbnailFromContentEntityScene,
  sanitizePlaceDescription,
} from "../../Place/utils"
import { PlaceContentRatingAttributes } from "../../PlaceContentRating/types"
import { notifyDowngradeRating, notifyUpgradingRating } from "../../Slack/utils"
import { findNewDeployedPlace, findSamePlace } from "../utils"

export function assertSceneBaseIsAuthorized(
  contentEntityScene: ContentEntityScene
): void {
  const pointers = contentEntityScene.pointers
  const scene = contentEntityScene.metadata?.scene

  if (
    !SceneParcels.validate(scene) ||
    !SceneParcels.validate({ base: pointers?.[0], parcels: pointers }) ||
    scene.parcels.length !== pointers.length ||
    scene.parcels.some((parcel) => !pointers.includes(parcel))
  ) {
    throw new InvalidSceneBaseError(contentEntityScene.metadata?.scene?.base)
  }
}

export type ProcessEntitySceneResult =
  | {
      new: PlaceAttributes
      update?: never
      rating: PlaceContentRatingAttributes | null
      disabled: PlaceAttributes[]
    }
  | {
      new?: never
      update: PlaceAttributes
      rating: PlaceContentRatingAttributes | null
      disabled: PlaceAttributes[]
    }

export function processContentEntityScene(
  contentEntityScene: ContentEntityScene,
  places: PlaceAttributes[],
  options: {
    url?: string
    creator?: string | null
    sdk?: string | null
    deploymentId?: string | null
  } = {}
): ProcessEntitySceneResult | null {
  const samePlace = findSamePlace(contentEntityScene, places)
  const newDeployedPlace = findNewDeployedPlace(contentEntityScene, places)
  if (newDeployedPlace) {
    return null
  }
  if (!samePlace) {
    const placefromContentEntity = createPlaceFromContentEntityScene(
      contentEntityScene,
      inheritedCuration(places, options.creator),
      options
    )
    return {
      new: placefromContentEntity,
      rating: {
        id: randomUUID(),
        entity_id: placefromContentEntity.id,
        original_rating: null,
        update_rating: placefromContentEntity.content_rating,
        moderator: null,
        comment: null,
        created_at: new Date(),
      },
      disabled: places,
    }
  }

  const placefromContentEntity = createPlaceFromContentEntityScene(
    contentEntityScene,
    samePlace,
    options
  )

  let rating = null
  if (placefromContentEntity.content_rating !== samePlace.content_rating) {
    rating = {
      id: randomUUID(),
      entity_id: samePlace.id,
      original_rating: samePlace.content_rating,
      update_rating: placefromContentEntity.content_rating,
      moderator: null,
      comment: null,
      created_at: new Date(),
    }
  }

  return {
    update: placefromContentEntity,
    rating,
    disabled: places.filter((place) => samePlace.id !== place.id),
  }
}

/**
 * Carry the editorial curation of the place a redeployment replaces.
 *
 * A creator who redeploys with a different base parcel or footprint stops matching
 * `findSamePlace`, so the deployment lands on a new row and the place it supersedes is
 * disabled. Without this the new row starts at the column defaults, silently dropping
 * the highlighted flag and the hand-set ranking, which is why curated positions kept
 * reverting a day after being set.
 *
 * Inheriting is deliberately narrow. The candidates are only the places overlapping the
 * incoming pointers, and a deployment landing on someone else's parcels is a takeover,
 * not a continuation: carrying curation there would promote a scene nobody curated into
 * the highlighted shelf. So it requires a single curated predecessor published by the
 * same known creator, and a place whose creator was never recorded inherits nothing.
 */
function inheritedCuration(
  places: PlaceAttributes[],
  creator?: string | null
): Partial<Omit<PlaceAttributes, "id">> {
  if (!creator) {
    return {}
  }

  const curated = places.filter(
    (place) =>
      (place.highlighted || (place.ranking ?? 0) > 0) &&
      place.creator_address === creator
  )

  if (curated.length !== 1) {
    return {}
  }

  const [predecessor] = curated

  return {
    highlighted: predecessor.highlighted,
    highlighted_image: predecessor.highlighted_image,
    ranking: predecessor.ranking,
  }
}

export function createPlaceFromContentEntityScene(
  contentEntityScene: ContentEntityScene,
  data: Partial<Omit<PlaceAttributes, "id">> = {},
  options: {
    url?: string
    creator?: string | null
    sdk?: string | null
    worldId?: string | null
    deploymentId?: string | null
  } = {}
) {
  const now = new Date()
  const title = contentEntityScene?.metadata?.display?.title || null
  const positions = (contentEntityScene?.pointers || []).sort()

  const thumbnail = getThumbnailFromContentEntityScene(
    contentEntityScene,
    options
  )

  let contact_name = contentEntityScene?.metadata?.contact?.name || null
  if (contact_name && contact_name.trim() === "author-name") {
    contact_name = null
  }

  const worldName =
    contentEntityScene?.metadata?.worldConfiguration?.name ||
    contentEntityScene?.metadata?.worldConfiguration?.dclName ||
    null

  const contentEntitySceneRating =
    contentEntityScene?.metadata?.policy?.contentRating ||
    SceneContentRating.RATING_PENDING
  if (
    data.content_rating &&
    isDowngradingRating(
      contentEntitySceneRating,
      data.content_rating as SceneContentRating
    )
  ) {
    notifyDowngradeRating(data as PlaceAttributes, contentEntitySceneRating)
  } else if (
    data.content_rating &&
    isUpgradingRating(
      contentEntitySceneRating,
      data.content_rating as SceneContentRating
    )
  ) {
    notifyUpgradingRating(
      data as PlaceAttributes,
      "Content Creator",
      contentEntitySceneRating
    )
  }

  const placeParsed: PlaceAttributes = {
    id: randomUUID(),
    likes: 0,
    dislikes: 0,
    favorites: 0,
    like_rate: 0.5,
    like_score: 0,
    highlighted: false,
    highlighted_image: null,
    ranking: 0,
    disabled: false,
    world: !!contentEntityScene?.metadata?.worldConfiguration,
    world_name: worldName,
    world_id: options.worldId || null,
    ...data,
    deployment_id: options.deploymentId || null,
    title: title ? title.slice(0, 50) : "Untitled",
    // Strip markup from the creator-authored description before storing so
    // TMP tags like `<link="decentraland://…">` / `smb://` / `file://`
    // that the Unity client renders (and opens on click, unprompted) are
    // neutralized at rest, covering every read path uniformly. Stripping
    // rather than html-escaping keeps the text clean, since the client is
    // TextMeshPro (which does not decode HTML entities), not an HTML
    // renderer. The social/OG HTML path keeps its own escape() in
    // Social/routes.ts.
    description: sanitizePlaceDescription(
      contentEntityScene?.metadata?.display?.description
    ),
    owner: contentEntityScene?.metadata?.owner || null,
    image: thumbnail,
    base_position: contentEntityScene?.metadata?.scene?.base || positions[0],
    positions,
    contact_name,
    contact_email: contentEntityScene?.metadata?.contact?.email || null,
    content_rating: getContentRating(contentEntityScene, data),
    created_at: now,
    updated_at: now,
    deployed_at: new Date(contentEntityScene.timestamp),
    disabled_at: data.disabled ? data.disabled_at || now : null,
    disabled_reason: data.disabled ? data.disabled_reason || null : null,
    textsearch: undefined,
    categories: [],
    creator_address: options.creator || null,
    sdk: options.sdk || null,
  }

  placeParsed.textsearch = PlaceModel.textsearch(placeParsed)

  return placeParsed
}
