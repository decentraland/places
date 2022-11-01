import { validateMigratedPlaces } from "../entities/Place/migration"
import Places01 from "./01_places.json"
import Places02 from "./02_places.json"

test("should be able to migrate all default places", async () => {
  expect(await validateMigratedPlaces(Places01)).toBeTruthy()
  expect(await validateMigratedPlaces(Places02)).toBeTruthy()
})
