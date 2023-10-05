import {
  ContentEntityScene,
  SceneContentRating,
} from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import { v4 as uuid } from "uuid"

import getContentRating, {
  isDowngradingRating,
  isUpgradingRating,
} from "../../../utils/rating/contentRating"
import PlaceModel from "../../Place/model"
import { PlaceAttributes } from "../../Place/types"
import { getThumbnailFromContentDeployment as getThumbnailFromContentEntityScene } from "../../Place/utils"
import { PlaceContentRatingAttributes } from "../../PlaceContentRating/types"
import { notifyDowngradeRating, notifyUpgradingRating } from "../../Slack/utils"
import { findNewDeployedPlace, findSamePlace } from "../utils"

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
  places: PlaceAttributes[]
): ProcessEntitySceneResult | null {
  const samePlace = findSamePlace(contentEntityScene, places)
  const newDeployedPlace = findNewDeployedPlace(contentEntityScene, places)
  if (newDeployedPlace) {
    return null
  }
  if (!samePlace) {
    const placefromContentEntity =
      createPlaceFromContentEntityScene(contentEntityScene)
    return {
      new: placefromContentEntity,
      rating: {
        id: uuid(),
        place_id: placefromContentEntity.id,
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
    samePlace
  )

  let rating = null
  if (placefromContentEntity.content_rating !== samePlace.content_rating) {
    rating = {
      id: uuid(),
      place_id: samePlace.id,
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

export function createPlaceFromContentEntityScene(
  contentEntityScene: ContentEntityScene,
  data: Partial<Omit<PlaceAttributes, "id">> = {},
  options: { url?: string } = {}
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
    notifyUpgradingRating(data as PlaceAttributes, "Content Creator")
  }

  const placeParsed: PlaceAttributes = {
    id: uuid(),
    likes: 0,
    dislikes: 0,
    favorites: 0,
    like_rate: 0.5,
    like_score: 0,
    highlighted: false,
    highlighted_image: null,
    disabled: false,
    updated_at: now,
    world: !!contentEntityScene?.metadata?.worldConfiguration,
    world_name: worldName,
    hidden: !!contentEntityScene?.metadata?.worldConfiguration,
    ...data,
    title: title ? title.slice(0, 50) : "Untitled",
    description: contentEntityScene?.metadata?.display?.description || null,
    owner: contentEntityScene?.metadata?.owner || null,
    image: thumbnail,
    base_position: contentEntityScene?.metadata?.scene?.base || positions[0],
    positions,
    contact_name,
    contact_email: contentEntityScene?.metadata?.contact?.email || null,
    content_rating: getContentRating(contentEntityScene, data),
    created_at: now,
    deployed_at: new Date(contentEntityScene.timestamp),
    disabled_at:
      !!data.disabled && !data.disabled_at ? now : data.disabled_at || null,
    textsearch: undefined,
  }

  placeParsed.textsearch = PlaceModel.textsearch(placeParsed)

  return placeParsed
}
