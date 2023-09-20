import { ContentEntityScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { PlaceAttributes, PlaceRating } from "../../entities/Place/types"

export default function getContentRating(
  contentEntityScene: ContentEntityScene,
  originalPlace?: Partial<PlaceAttributes>
) {
  const placeRatings = new Set(Object.values(PlaceRating) as string[])

  const contentEntitySceneRating =
    contentEntityScene?.metadata?.policy?.contentRating

  if (
    !contentEntitySceneRating ||
    (!placeRatings.has(contentEntitySceneRating) &&
      contentEntitySceneRating !== "M")
  ) {
    return PlaceRating.RATING_PENDING
  }

  if (contentEntitySceneRating === "M") {
    return PlaceRating.ADULT
  }

  if (!originalPlace) {
    return contentEntitySceneRating as PlaceRating
  }

  const originalRating =
    (originalPlace.content_rating as PlaceRating) || PlaceRating.RATING_PENDING

  if (
    isDowngradingRating(contentEntitySceneRating as PlaceRating, originalRating)
  ) {
    return originalRating
  }

  return contentEntitySceneRating as PlaceRating
}

export function isDowngradingRating(
  rating: PlaceRating,
  originalRating: PlaceRating
) {
  const ratingScale = [
    PlaceRating.RATING_PENDING,
    PlaceRating.EVERYONE,
    PlaceRating.TEEN,
    PlaceRating.ADULT,
    PlaceRating.RESTRICTED,
  ]

  const originalIndex = ratingScale.indexOf(originalRating)
  const contentEntityIndex = ratingScale.indexOf(rating)

  return originalIndex > contentEntityIndex
}
