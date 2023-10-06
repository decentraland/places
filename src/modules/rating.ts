import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

export const getRating = (
  rating: SceneContentRating,
  defaultRating?: SceneContentRating
) => {
  const data = new Set(Object.values(SceneContentRating))
  return data.has(rating) ? rating : defaultRating || SceneContentRating.TEEN
}
