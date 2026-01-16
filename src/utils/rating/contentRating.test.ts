import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import getContentRating, {
  isDowngradingRating,
  isUpgradingRating,
} from "./contentRating"
import { contentEntitySceneGenesisPlaza } from "../../__data__/contentEntitySceneGenesisPlaza"
import { contentEntitySceneMusicFestivalStage } from "../../__data__/contentEntitySceneMusicFestivalStage"
import { contentEntitySceneSteamPunkDCQuest } from "../../__data__/contentEntitySceneSteamPunkDCQuest"
import { placeGenesisPlaza } from "../../__data__/placeGenesisPlaza"

describe("Validate rating", () => {
  test(`Without a rating in the list of ratings return RP`, () => {
    expect(getContentRating(contentEntitySceneGenesisPlaza)).toBe(
      SceneContentRating.RATING_PENDING
    )
  })
  test(`With M rating return A`, () => {
    expect(
      getContentRating({
        ...contentEntitySceneMusicFestivalStage,
        metadata: {
          ...contentEntitySceneMusicFestivalStage.metadata,
          policy: {
            ...contentEntitySceneMusicFestivalStage.metadata.policy!,
            contentRating: "M" as SceneContentRating,
          },
        },
      })
    ).toBe(SceneContentRating.ADULT)
  })
  test(`With E rating return E`, () => {
    expect(getContentRating(contentEntitySceneSteamPunkDCQuest)).toBe(
      SceneContentRating.TEEN
    )
  })
  test(`With T rating and trying to downgrade from original R return R`, () => {
    expect(
      getContentRating(
        {
          ...contentEntitySceneGenesisPlaza,
          metadata: {
            ...contentEntitySceneGenesisPlaza.metadata,
            policy: {
              contentRating: SceneContentRating.TEEN,
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
  test(`Should return false if it's upgrading rating from A to T`, () => {
    expect(
      isUpgradingRating(SceneContentRating.TEEN, SceneContentRating.ADULT)
    ).toBeFalsy()
  })
})
