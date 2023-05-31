import { contentEntitySceneGenesisPlaza } from "../../__data__/contentEntitySceneGenesisPlaza"
import { placeGenesisPlaza } from "../../__data__/placeGenesisPlaza"
import { placeGenesisPlazaWithAggregatedAttributes } from "../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import { placeRoad } from "../../__data__/placeRoad"
import { sqsMessageWorld } from "../../__data__/sqs"
import {
  worldAboutParalax,
  worldContentEntitySceneParalax,
  worldPlaceParalax,
} from "../../__data__/world"
import {
  findNewDeployedPlace,
  findSamePlace,
  getWorldAbout,
  isSameWorld,
} from "./utils"

describe("isNewPlace", () => {
  test("should return the place found if not new place with same base position", async () => {
    expect(
      findSamePlace(contentEntitySceneGenesisPlaza, [
        placeGenesisPlazaWithAggregatedAttributes,
      ])
    ).toBe(placeGenesisPlazaWithAggregatedAttributes)
  })

  test("should return the place found if not new place with different base position", async () => {
    expect(
      findSamePlace(
        {
          ...contentEntitySceneGenesisPlaza,
          metadata: {
            ...contentEntitySceneGenesisPlaza.metadata,
            scene: {
              parcels: contentEntitySceneGenesisPlaza.metadata.scene!.parcels,
              base: "0,0",
            },
          },
        },
        [placeGenesisPlazaWithAggregatedAttributes]
      )
    ).toBe(placeGenesisPlazaWithAggregatedAttributes)
  })

  test("should return true, is new place", async () => {
    expect(findSamePlace(contentEntitySceneGenesisPlaza, [])).toBeNull()
  })
})

describe("findNewDeployedPlace", () => {
  test("should return null if there are no places", async () => {
    expect(findNewDeployedPlace(contentEntitySceneGenesisPlaza, [])).toBeNull()
  })
  test("should return null when the content entity scene do not find a place with deployed_at newer", async () => {
    expect(
      findNewDeployedPlace(contentEntitySceneGenesisPlaza, [
        placeRoad,
        { ...placeGenesisPlaza, deployed_at: new Date("2021-01-01") },
      ])
    ).toBeNull()
  })
  test("should return a place when the content entity scene find a place with deployed_at newer", async () => {
    const now = new Date()
    expect(
      findNewDeployedPlace(contentEntitySceneGenesisPlaza, [
        { ...placeGenesisPlaza, deployed_at: now },
      ])
    ).toEqual({ ...placeGenesisPlaza, deployed_at: now })
  })
})

describe("isSameWorld", () => {
  test("should return true, is same world", async () => {
    expect(
      isSameWorld(worldContentEntitySceneParalax, worldPlaceParalax)
    ).toBeTruthy()
  })

  test("should return false, is not same world", async () => {
    expect(findSamePlace(contentEntitySceneGenesisPlaza, [])).toBeNull()
  })
})

describe("getWorldAbout", () => {
  test("should return world about", async () => {
    const worldAbout = await getWorldAbout(
      sqsMessageWorld.contentServerUrls![0],
      worldContentEntitySceneParalax.metadata.worldConfiguration!.name
    )
    expect(worldAbout).toEqual({
      ...worldAboutParalax,
      configurations: worldAbout.configurations,
    })
  })
})
