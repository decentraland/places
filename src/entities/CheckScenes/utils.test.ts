import {
  contentEntitySceneGenesisPlaza,
  contentEntitySceneRoad,
  placeGenesisPlazaWithAggregatedAttributes,
  sqsMessageWorld,
  worldAboutParalax,
  worldContentEntitySceneParalax,
  worldPlaceParalax,
} from "../../__data__/entities"
import { findSamePlace, getWorldAbout, isRoad, isSameWorld } from "./utils"

describe("isRoads", () => {
  test("should return true, this is a road", async () => {
    expect(isRoad(contentEntitySceneRoad)).toBeTruthy()
  })
})

describe("isNewPlace", () => {
  test("should return false, is not new place", async () => {
    expect(
      findSamePlace(contentEntitySceneGenesisPlaza, [
        placeGenesisPlazaWithAggregatedAttributes,
      ])
    ).toBe(placeGenesisPlazaWithAggregatedAttributes)
  })

  test("should return true, is new place", async () => {
    expect(findSamePlace(contentEntitySceneGenesisPlaza, [])).toBeNull()
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
    expect(worldAbout).toEqual(worldAboutParalax)
  })
})
