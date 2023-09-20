import { contentEntitySceneGenesisPlaza } from "../../__data__/contentEntitySceneGenesisPlaza"
import { contentEntitySceneMusicFestivalStage } from "../../__data__/contentEntitySceneMusicFestivalStage"
import { contentEntitySceneSteamPunkDCQuest } from "../../__data__/contentEntitySceneSteamPunkDCQuest"
import { placeGenesisPlaza } from "../../__data__/placeGenesisPlaza"
import { PlaceRating } from "../../entities/Place/types"
import getContentRating, { isDowngradingRating } from "./contentRating"

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
  test(`With E rating and trying to downgrade from original R return R`, () => {
    expect(
      getContentRating(
        {
          ...contentEntitySceneGenesisPlaza,
          metadata: {
            ...contentEntitySceneGenesisPlaza.metadata,
            policy: {
              contentRating: "E",
              fly: true,
              voiceEnabled: true,
              blacklist: [],
              teleportPosition: "",
            },
          },
        },
        { ...placeGenesisPlaza, content_rating: PlaceRating.RESTRICTED }
      )
    ).toBe(PlaceRating.RESTRICTED)
  })
})

describe("Validate downgrading", () => {
  test(`Should return true if it's downgrading rating from R to RP`, () => {
    expect(
      isDowngradingRating(PlaceRating.RATING_PENDING, PlaceRating.RESTRICTED)
    ).toBeTruthy()
  })
  test(`Should return false if it's same rating`, () => {
    expect(isDowngradingRating(PlaceRating.TEEN, PlaceRating.TEEN)).toBeFalsy()
  })
  test(`Should return false if it's upgrading rating from E to A`, () => {
    expect(
      isDowngradingRating(PlaceRating.ADULT, PlaceRating.EVERYONE)
    ).toBeFalsy()
  })
})
