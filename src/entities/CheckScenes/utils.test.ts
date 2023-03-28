import {
  contentEntitySceneGenesisPlaza,
  contentEntitySceneRoad,
  placeGenesisPlazaWithAggregatedAttributes,
} from "../../__data__/entities"
import { isNewPlace, isRoad, isSamePlace } from "./utils"

describe("isRoads", () => {
  test("should return true, this is a road", async () => {
    expect(isRoad(contentEntitySceneRoad)).toBeTruthy()
  })
})

describe("isNewPlace", () => {
  test("should return false, is not new place", async () => {
    expect(
      isNewPlace(contentEntitySceneGenesisPlaza, [
        placeGenesisPlazaWithAggregatedAttributes,
      ])
    ).toBeFalsy()
  })

  test("should return true, is new place", async () => {
    expect(isNewPlace(contentEntitySceneGenesisPlaza, [])).toBeTruthy()
  })
})

describe("isSamePlace", () => {
  test("should return true, is the same place", async () => {
    expect(
      isSamePlace(
        contentEntitySceneGenesisPlaza,
        placeGenesisPlazaWithAggregatedAttributes
      )
    ).toBeTruthy()
  })
})
