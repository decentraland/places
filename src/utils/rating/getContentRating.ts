import { ContentEntityScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { PlaceRating } from "../../entities/Place/types"

export default function getContentRating(
  contentEntityScene: ContentEntityScene
) {
  const placeRatings = new Set(Object.values(PlaceRating) as string[])
  if (!contentEntityScene?.metadata?.policy?.contentRating) {
    return PlaceRating.RATING_PENDING
  }

  if (contentEntityScene.metadata.policy.contentRating === "M") {
    return PlaceRating.ADULT
  }

  return placeRatings.has(contentEntityScene.metadata.policy.contentRating)
    ? (contentEntityScene.metadata.policy.contentRating as PlaceRating)
    : PlaceRating.RATING_PENDING
}
