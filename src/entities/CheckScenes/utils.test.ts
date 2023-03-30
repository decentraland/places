import {
  contentEntitySceneGenesisPlaza,
  contentEntitySceneRoad,
  placeGenesisPlazaWithAggregatedAttributes,
} from "../../__data__/entities"
import { findSamePlace, isRoad } from "./utils"

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
