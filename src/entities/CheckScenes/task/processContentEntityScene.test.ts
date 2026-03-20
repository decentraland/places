import { SQLStatement } from "decentraland-gatsby/dist/entities/Database/utils"

import {
  createPlaceFromContentEntityScene,
  processContentEntityScene,
} from "./processContentEntityScene"
import { contentEntitySceneGenesisPlaza } from "../../../__data__/contentEntitySceneGenesisPlaza"
import { contentEntitySceneMusicFestivalStage } from "../../../__data__/contentEntitySceneMusicFestivalStage"
import { placeGenesisPlaza } from "../../../__data__/placeGenesisPlaza"
import { placeGenesisPlazaWithAggregatedAttributes } from "../../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import { DisabledReason } from "../../Place/types"

describe("createPlaceFromContentEntityScene", () => {
  test("should accept a contentEntityScene and return a formatted place", async () => {
    const contentEntityDeployment = createPlaceFromContentEntityScene(
      contentEntitySceneGenesisPlaza
    )
    expect(contentEntityDeployment).toEqual({
      ...placeGenesisPlaza,
      id: contentEntityDeployment.id,
      updated_at: contentEntityDeployment.updated_at,
      created_at: contentEntityDeployment.created_at,
      textsearch: expect.any(SQLStatement),
    })
  })

  describe("when the place was previously disabled with opt_out", () => {
    describe("and it is re-enabled", () => {
      let result: ReturnType<typeof createPlaceFromContentEntityScene>

      beforeEach(() => {
        result = createPlaceFromContentEntityScene(
          contentEntitySceneGenesisPlaza,
          {
            ...placeGenesisPlaza,
            disabled: false,
            disabled_at: new Date("2025-01-01"),
            disabled_reason: DisabledReason.OPT_OUT,
          }
        )
      })

      it("should set disabled to false and clear disabled_at and disabled_reason to null", () => {
        expect(result.disabled).toBe(false)
        expect(result.disabled_at).toBeNull()
        expect(result.disabled_reason).toBeNull()
      })
    })
  })

  describe("when the place is created with opt_out", () => {
    let result: ReturnType<typeof createPlaceFromContentEntityScene>

    beforeEach(() => {
      result = createPlaceFromContentEntityScene(
        contentEntitySceneGenesisPlaza,
        {
          disabled: true,
          disabled_reason: DisabledReason.OPT_OUT,
        }
      )
    })

    it("should set disabled to true, disabled_at to a date, and disabled_reason to opt_out", () => {
      expect(result.disabled).toBe(true)
      expect(result.disabled_at).toBeInstanceOf(Date)
      expect(result.disabled_reason).toBe(DisabledReason.OPT_OUT)
    })
  })
})

describe("processContentEntityScene", () => {
  test("should return an object with new place and no disabled places", async () => {
    const processEntitySceneResult = processContentEntityScene(
      contentEntitySceneGenesisPlaza,
      []
    )
    expect(processEntitySceneResult).toEqual({
      new: {
        ...createPlaceFromContentEntityScene(contentEntitySceneGenesisPlaza),
        id: processEntitySceneResult!.new!.id,
        created_at: processEntitySceneResult!.new!.created_at,
        updated_at: processEntitySceneResult!.new!.updated_at,
      },
      rating: processEntitySceneResult?.rating,
      disabled: [],
    })
  })

  test("should return an object with update place and no disabled places", async () => {
    const processEntitySceneResult = processContentEntityScene(
      contentEntitySceneGenesisPlaza,
      [
        {
          ...placeGenesisPlazaWithAggregatedAttributes,
          deployed_at: new Date("2020-01-01"),
        },
      ]
    )

    expect(processEntitySceneResult).toEqual({
      update: {
        ...createPlaceFromContentEntityScene(
          contentEntitySceneGenesisPlaza,
          placeGenesisPlazaWithAggregatedAttributes
        ),
        created_at: processEntitySceneResult!.update!.created_at,
        updated_at: processEntitySceneResult!.update!.updated_at,
      },
      rating: processEntitySceneResult?.rating,
      disabled: [],
    })
  })

  test("should return an object with new place and disabled places", async () => {
    const processEntitySceneResult = processContentEntityScene(
      contentEntitySceneMusicFestivalStage,
      [placeGenesisPlazaWithAggregatedAttributes]
    )

    expect(processEntitySceneResult).toEqual({
      new: {
        ...createPlaceFromContentEntityScene(
          contentEntitySceneMusicFestivalStage
        ),
        id: processEntitySceneResult!.new!.id,
        created_at: processEntitySceneResult!.new!.created_at,
        updated_at: processEntitySceneResult!.new!.updated_at,
      },
      rating: processEntitySceneResult?.rating,
      disabled: [placeGenesisPlazaWithAggregatedAttributes],
    })
  })

  test("should return an object with update place and disabled places", async () => {
    const processEntitySceneResult = processContentEntityScene(
      contentEntitySceneMusicFestivalStage,
      [
        placeGenesisPlazaWithAggregatedAttributes,
        {
          ...createPlaceFromContentEntityScene(
            contentEntitySceneMusicFestivalStage
          ),
          deployed_at: new Date("2020-01-01"),
        },
      ]
    )

    expect(processEntitySceneResult).toEqual({
      update: {
        ...createPlaceFromContentEntityScene(
          contentEntitySceneMusicFestivalStage
        ),
        id: processEntitySceneResult!.update!.id,
        created_at: processEntitySceneResult!.update!.created_at,
        updated_at: processEntitySceneResult!.update!.updated_at,
      },
      rating: processEntitySceneResult?.rating,
      disabled: [placeGenesisPlazaWithAggregatedAttributes],
    })
  })

  test("should return nunll if the deployed_at time is newer than the EntityScene", async () => {
    const processEntitySceneResult = processContentEntityScene(
      contentEntitySceneMusicFestivalStage,
      [
        placeGenesisPlazaWithAggregatedAttributes,
        {
          ...createPlaceFromContentEntityScene(
            contentEntitySceneMusicFestivalStage
          ),
          deployed_at: new Date(),
        },
      ]
    )

    expect(processEntitySceneResult).toBeNull()
  })
})
