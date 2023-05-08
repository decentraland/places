import { validatePlacesWorlds } from "../entities/Place/migration"

const files = ["31_places_new.json", "32_places_new.json"]

for (const file of files) {
  test(`should be able to migrate ${file} places`, async () => {
    const places = await import(`./${file}`)
    expect(await validatePlacesWorlds(places.update)).toBeUndefined()
  })
}
