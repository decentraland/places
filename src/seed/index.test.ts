import { validateMigratedPlaces } from "../entities/Place/migration"

const files = [
  "01_places.json",
  "02_places.json",
  "03_places.json",
  "04_places.json",
  "05_places.json",
  "06_places.json",
  "07_places.json",
  "08_places.json",
  "09_places.json",
  "10_places.json",
  "11_places.json",
  "12_places.json",
  "13_places.json",
  "14_places.json",
  "15_places.json",
  "16_places.json",
  "17_places.json",
  "18_places.json",
  "19_places.json",
  "20_places.json",
  "21_places.json",
  "22_places.json",
  "23_places.json",
  "24_places.json",
  "25_places.json",
]

for (const file of files) {
  test(`should be able to migrate ${file} places`, async () => {
    const places = await import(`./${file}`)
    expect(await validateMigratedPlaces(places)).toBeTruthy()
  })
}
