import {
  contentEntitySceneGenesisPlaza,
  contentEntitySceneRoad,
  placeGenesisPlaza,
} from "../../__data__/entities"
import { isNewPlace, isRoad, isSamePlace } from "./utils"

describe("isRoads", () => {
  test("should accept a contentDeployment and return that is a road (true)", async () => {
    expect(isRoad(contentEntitySceneRoad)).toBeTruthy()
  })
})

describe("isNewPlace", () => {
  test("should accept a contentEntityScene and array of places and return is not new (false)", async () => {
    expect(
      isNewPlace(contentEntitySceneGenesisPlaza, [placeGenesisPlaza])
    ).toBeFalsy()
  })

  test("should accept a contentEntityScene and array of places and return is new (true)", async () => {
    expect(isNewPlace(contentEntitySceneGenesisPlaza, [])).toBeTruthy()
  })
})

describe("isSamePlace", () => {
  test("should accept a contentEntityScene and a places and return is the same place (true)", async () => {
    expect(
      isSamePlace(contentEntitySceneGenesisPlaza, placeGenesisPlaza)
    ).toBeTruthy()
  })
})
