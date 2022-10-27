import { MigrationBuilder } from "node-pg-migrate"

import { isMetadataEmpty, isRoad } from "../DeploymentTrack/utils"
import PlaceModel from "./model"
import { PlaceAttributes } from "./types"
import {
  createEntityScenesFromDefaultPlaces,
  createPlaceFromDefaultPlaces,
} from "./utils"

export type PlacesStatic = {
  create: Array<Partial<PlaceAttributes>>
  update: Array<Partial<PlaceAttributes>>
  delete: string[]
}

async function validatePlaces(places: Partial<PlaceAttributes>[]) {
  if (places.length > 0) {
    const entityScenesCreate = await createEntityScenesFromDefaultPlaces(places)

    const invalidPlacesCreate = entityScenesCreate.filter((scene) =>
      isRoad(scene)
    )
    if (invalidPlacesCreate.length > 0) {
      throw new Error(
        "There is an error with places provided. Migration can't proccede. The following places can proccede: " +
          JSON.stringify(
            invalidPlacesCreate.map((place) => place.metadata.scene.base),
            null,
            2
          )
      )
    }
  }
}

export async function validateMigratedPlaces(defaultPlaces: PlacesStatic) {
  await validatePlaces(defaultPlaces.create)
  await validatePlaces(defaultPlaces.update)
  await validatePlaces(
    defaultPlaces.delete.map((position) => ({
      base_position: position,
    }))
  )
  return true
}

async function insertPlaces(
  places: Partial<PlaceAttributes>[],
  pgm: MigrationBuilder
) {
  if (places.length > 0) {
    const newPlaces = await createPlaceFromDefaultPlaces(places)
    newPlaces.forEach((place) => {
      const keys = Object.keys(place) as Array<keyof typeof place>
      const queryString = `INSERT INTO ${PlaceModel.tableName} (${keys.join(
        ","
      )})
            VALUES (${keys.map((k, i) => `$${i + 1}`).join(",")})`
      pgm.db.query(
        queryString,
        keys.map((key) => place[key])
      )
    })
  }
}

async function updatePlaces(
  places: Partial<PlaceAttributes>[],
  pgm: MigrationBuilder
) {
  if (places.length > 0) {
    const updatePlaces = await createPlaceFromDefaultPlaces(places)
    updatePlaces.forEach((place) => {
      const keys = Object.keys(place) as Array<keyof typeof place>
      const queryString = `UPDATE ${PlaceModel.tableName} SET ${keys
        .map((k, i) => `${k}=$${i + 1}`)
        .join(",")}  WHERE positions && ${
        "'{\"" + place.base_position + "\"}'"
      }`
      pgm.db.query(
        queryString,
        keys.map((key) => place[key])
      )
    })
  }
}

async function deletePlaces(places: string[], pgm: MigrationBuilder) {
  if (places.length > 0) {
    pgm.db.query(
      `DELETE FROM ${PlaceModel.tableName} WHERE positions && ${
        "'{" + JSON.stringify(places)?.slice(1, -1) + "}'"
      }`
    )
  }
}

export async function up(
  defaultPlaces: PlacesStatic,
  pgm: MigrationBuilder
): Promise<void> {
  await validateMigratedPlaces(defaultPlaces)

  await insertPlaces(defaultPlaces.create, pgm)
  await updatePlaces(defaultPlaces.update, pgm)
  await deletePlaces(defaultPlaces.delete, pgm)
}

export async function down(
  defaultPlaces: PlacesStatic,
  pgm: MigrationBuilder
): Promise<void> {
  const placesToRestore = {
    create: defaultPlaces.delete.map((position) => ({
      base_position: position,
    })),
    delete: defaultPlaces.create.map((place) => place.base_position!),
    update: [],
  }

  if (!(await validateMigratedPlaces(placesToRestore))) {
    throw new Error(
      "There is an error with places provided. Migration can't proccede"
    )
  }

  await deletePlaces(placesToRestore.delete, pgm)
  await insertPlaces(placesToRestore.create, pgm)
}

export function createPlaceMigration(defaultPlaces: PlacesStatic) {
  return {
    up: async (pgm: MigrationBuilder) => up(defaultPlaces, pgm),
    down: async (pgm: MigrationBuilder) => down(defaultPlaces, pgm),
  }
}
