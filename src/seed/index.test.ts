import { validateMigratedPlaces } from "../entities/Place/migration"

const files = ["01_places.json", "02_places.json"]

for (const file of files) {
  test(`should be able to migrate ${file} places`, async () => {
    const places = await import(`./${file}`)
    expect(await validateMigratedPlaces(places)).toBeTruthy()
  })
}
