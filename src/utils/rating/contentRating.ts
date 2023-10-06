import {
  ContentEntityScene,
  SceneContentRating,
} from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { PlaceAttributes } from "../../entities/Place/types"

export default function getContentRating(
  contentEntityScene: ContentEntityScene,
  originalPlace?: Partial<PlaceAttributes>
) {
  const placeRatings = new Set(Object.values(SceneContentRating) as string[])

  const contentEntitySceneRating =
    contentEntityScene?.metadata?.policy?.contentRating

  if (
    !contentEntitySceneRating ||
    (!placeRatings.has(contentEntitySceneRating) &&
      (contentEntitySceneRating as string) !== "M" &&
      (contentEntitySceneRating as string) !== "E")
  ) {
    return SceneContentRating.RATING_PENDING
  }

  if ((contentEntitySceneRating as string) === "E") {
    return SceneContentRating.TEEN
  }

  if ((contentEntitySceneRating as string) === "M") {
    return SceneContentRating.ADULT
  }

  if (!originalPlace) {
    return contentEntitySceneRating as SceneContentRating
  }

  const originalRating =
    (originalPlace.content_rating as SceneContentRating) ||
    SceneContentRating.RATING_PENDING

  if (
    isDowngradingRating(
      contentEntitySceneRating as SceneContentRating,
      originalRating
    )
  ) {
    return originalRating
  }

  return contentEntitySceneRating as SceneContentRating
}

const ratingScale = [
  SceneContentRating.RATING_PENDING,
  SceneContentRating.TEEN,
  SceneContentRating.ADULT,
  SceneContentRating.RESTRICTED,
]

export function isDowngradingRating(
  rating: SceneContentRating,
  originalRating: SceneContentRating
) {
  const originalIndex = ratingScale.indexOf(originalRating)
  const contentEntityIndex = ratingScale.indexOf(rating)

  return originalIndex > contentEntityIndex
}

export function isUpgradingRating(
  rating: SceneContentRating,
  originalRating: SceneContentRating
) {
  const originalIndex = ratingScale.indexOf(originalRating)
  const contentEntityIndex = ratingScale.indexOf(rating)

  return originalIndex < contentEntityIndex
}
