import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { getRating } from "./rating"

test("src/modules/rating", () => {
  expect(getRating(SceneContentRating.ADULT)).toBe(SceneContentRating.ADULT)
  expect(
    getRating("M" as SceneContentRating.ADULT, SceneContentRating.ADULT)
  ).toBe(SceneContentRating.ADULT)
  expect(getRating("M" as SceneContentRating.ADULT)).toBe(
    SceneContentRating.TEEN
  )
})
