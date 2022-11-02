import { readFileSync, readdirSync, writeFileSync } from "fs"
import { resolve } from "path"

Promise.resolve().then(async () => {
  const seedFolder = resolve(__dirname, "../src/seed")
  const filesInFolder = readdirSync(seedFolder)

  const placesJsonFiles = filesInFolder.filter((file) => file.endsWith(".json"))

  const placesFromExample = resolve(
    __dirname,
    "../src/seed/places.json.example"
  )
  const places = readFileSync(placesFromExample, {
    encoding: "utf8",
    flag: "r",
  })

  const placesStringWithoutComments = places.replace(
    /(\/\*[^*]*\*\/)|(\/\/[^*]*)/g,
    ""
  )

  const newPlacesFile = `${(placesJsonFiles.length + 1)
    .toString()
    .padStart(2, "0")}_places.json`

  const newPlacesTarget = resolve(__dirname, `../src/seed/${newPlacesFile}`)
  console.log(`creating ${newPlacesTarget}`)
  writeFileSync(newPlacesTarget, placesStringWithoutComments)

  placesJsonFiles.push(newPlacesFile)

  const testFromExample = resolve(__dirname, "../src/seed/index.test.example")
  const testExample = readFileSync(testFromExample, {
    encoding: "utf8",
    flag: "r",
  })

  const testString = testExample.replace(
    "FILENAME",
    `"${placesJsonFiles.join('", "')}"`
  )

  const testTarget = resolve(__dirname, `../src/seed/index.test.ts`)
  console.log(`updating test file with filenames ${placesJsonFiles.join(", ")}`)
  writeFileSync(testTarget, testString)

  const migrationFromExample = resolve(
    __dirname,
    "../src/seed/migration.ts.example"
  )
  const migrationExample = readFileSync(migrationFromExample, {
    encoding: "utf8",
    flag: "r",
  })

  const migrationString = migrationExample.replace(
    "FILENAME",
    `${newPlacesFile}`
  )
  const migrationFileName = `${new Date().getTime()}_automatic-update-static-places`
  const migrationTarget = resolve(
    __dirname,
    `../src/migrations/${migrationFileName}`
  )
  console.log(`adding new migration file ${placesJsonFiles.join(", ")}`)
  writeFileSync(migrationTarget, migrationString)
})
