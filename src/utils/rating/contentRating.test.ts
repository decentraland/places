import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { contentEntitySceneGenesisPlaza } from "../../__data__/contentEntitySceneGenesisPlaza"
import { contentEntitySceneMusicFestivalStage } from "../../__data__/contentEntitySceneMusicFestivalStage"
import { contentEntitySceneSteamPunkDCQuest } from "../../__data__/contentEntitySceneSteamPunkDCQuest"
import { placeGenesisPlaza } from "../../__data__/placeGenesisPlaza"
import getContentRating, { isDowngradingRating } from "./contentRating"

describe("Validate rating", () => {
  test(`Without a rating in the list of ratings return RP`, () => {
    expect(getContentRating(contentEntitySceneGenesisPlaza)).toBe(
      SceneContentRating.RATING_PENDING
    )
  })
  test(`With M rating return A`, () => {
    expect(getContentRating(contentEntitySceneMusicFestivalStage)).toBe(
      SceneContentRating.ADULT
    )
  })
  test(`With E rating return E`, () => {
    expect(getContentRating(contentEntitySceneSteamPunkDCQuest)).toBe(
      SceneContentRating.EVERYONE
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
              contentRating: SceneContentRating.EVERYONE,
              fly: true,
              voiceEnabled: true,
              blacklist: [],
              teleportPosition: "",
            },
          },
        },
        { ...placeGenesisPlaza, content_rating: SceneContentRating.RESTRICTED }
      )
    ).toBe(SceneContentRating.RESTRICTED)
  })
})

describe("Validate downgrading", () => {
  test(`Should return true if it's downgrading rating from R to RP`, () => {
    expect(
      isDowngradingRating(
        SceneContentRating.RATING_PENDING,
        SceneContentRating.RESTRICTED
      )
    ).toBeTruthy()
  })
  test(`Should return false if it's same rating`, () => {
    expect(
      isDowngradingRating(SceneContentRating.TEEN, SceneContentRating.TEEN)
    ).toBeFalsy()
  })
  test(`Should return false if it's upgrading rating from E to A`, () => {
    expect(
      isDowngradingRating(SceneContentRating.ADULT, SceneContentRating.EVERYONE)
    ).toBeFalsy()
  })
})
