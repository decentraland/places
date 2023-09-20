import { contentEntitySceneGenesisPlaza } from "../../__data__/contentEntitySceneGenesisPlaza"
import { contentEntitySceneMusicFestivalStage } from "../../__data__/contentEntitySceneMusicFestivalStage"
import { contentEntitySceneSteamPunkDCQuest } from "../../__data__/contentEntitySceneSteamPunkDCQuest"
import { PlaceRating } from "../../entities/Place/types"
import getContentRating from "./getContentRating"

describe("Validate rating", () => {
  test(`Without a rating in the list of ratings return RP`, () => {
    expect(getContentRating(contentEntitySceneGenesisPlaza)).toBe(
      PlaceRating.RATING_PENDING
    )
  })
  test(`With M rating return A`, () => {
    expect(getContentRating(contentEntitySceneMusicFestivalStage)).toBe(
      PlaceRating.ADULT
    )
  })
  test(`With E rating return E`, () => {
    expect(getContentRating(contentEntitySceneSteamPunkDCQuest)).toBe(
      PlaceRating.EVERYONE
    )
  })
})
