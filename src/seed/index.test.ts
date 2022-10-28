import { validateMigratedPlaces } from "../entities/Place/migration"
import Places01 from "./01_places.json"

test("should be able to migrate all default places", async () => {
  expect(await validateMigratedPlaces(Places01)).toBeTruthy()
})
