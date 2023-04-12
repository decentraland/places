import {
  contentEntitySceneGenesisPlaza,
  contentEntitySceneMusicFestivalStage,
  placeGenesisPlaza,
  placeGenesisPlazaWithAggregatedAttributes,
} from "../../../__data__/entities"
import {
  createPlaceFromContentEntityScene,
  processContentEntityScene,
} from "./processContentEntityScene"

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
