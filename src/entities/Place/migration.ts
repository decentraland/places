import Catalyst, {
  EntityScene,
} from "decentraland-gatsby/dist/utils/api/Catalyst"
import { ContentDeploymentScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import Time from "decentraland-gatsby/dist/utils/date/Time"
import env from "decentraland-gatsby/dist/utils/env"
import { MigrationBuilder } from "node-pg-migrate"
import { v4 as uuid } from "uuid"

import { isRoad } from "../CheckScenes/utils"
import PlaceModel from "./model"
import { PlaceAttributes } from "./types"
import {
  getThumbnailFromContentDeployment,
  getThumbnailFromDeployment,
} from "./utils"

export type PlacesStatic = {
  create: Array<Partial<PlaceAttributes>>
  update: Array<Partial<PlaceAttributes>>
  delete: string[]
}

const PLACES_URL = env("PLACES_URL", "https://places.decentraland.org")

/** @deprecated */
export function createPlaceFromEntityScene(
  entityScene: EntityScene,
  data: Partial<Omit<PlaceAttributes, "id">> = {}
) {
  const now = Time.from().format("YYYYMMDD hh:mm:ss ZZ")
  const title = entityScene?.metadata?.display?.title || null
  const positions = (entityScene?.pointers || []).sort()
  const tags = (entityScene?.metadata?.tags || [])
    .slice(0, 100)
    .map((tag) => tag.slice(0, 25))

  const thumbnail = getThumbnailFromDeployment(entityScene)

  let contact_name = entityScene?.metadata?.contact?.name || null
  if (contact_name && contact_name.trim() === "author-name") {
    contact_name = null
  }

  const placeParsed = {
    id: uuid(),
    owner: entityScene?.metadata?.owner || null,
    title: title ? title.slice(0, 50) : null,
    description: entityScene?.metadata?.display?.description || null,
    image: thumbnail,
    positions,
    tags,
    likes: 0,
    dislikes: 0,
    favorites: 0,
    like_rate: 0,
    base_position: entityScene?.metadata?.scene?.base || positions[0],
    contact_name,
    contact_email: entityScene?.metadata?.contact?.email || null,
    content_rating: entityScene?.metadata?.policy?.contentRating || null,
    highlighted: false,
    featured: false,
    disabled: false,
    disabled_at:
      !!data.disabled && !data.disabled_at ? now : data.disabled_at || null,
    created_at: now,
    updated_at: now,
    ...data,
  }

  if (placeParsed.image && !placeParsed.image.startsWith("https")) {
    placeParsed.image = new URL(placeParsed.image, PLACES_URL).toString()
  }

  return placeParsed
}

/** @deprecated */
async function fetchEntityScenesFromDefaultPlaces(
  places: Partial<PlaceAttributes>[]
) {
  const batch = places.map((place) => place.base_position!)
  return Catalyst.get().getEntityScenes(batch)
}

/** @deprecated */
async function createPlaceFromDefaultPlaces(
  places: Partial<PlaceAttributes>[]
) {
  const entityScenes = await fetchEntityScenesFromDefaultPlaces(places)
  return entityScenes.map((entityScene) =>
    createPlaceFromEntityScene(
      entityScene,
      places.find((place) =>
        entityScene.pointers.includes(place.base_position!)
      )
    )
  )
}

async function validatePlaces(places: Partial<PlaceAttributes>[]) {
  if (places.length > 0) {
    const entityScenesCreate = await fetchEntityScenesFromDefaultPlaces(places)

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
  await Promise.all([
    validatePlaces(defaultPlaces.create),
    validatePlaces(defaultPlaces.update),
    validatePlaces(
      defaultPlaces.delete.map((position) => ({
        base_position: position,
      }))
    ),
  ])
  return true
}

/** @deprecated */
async function insertPlacesWithEntityScenes(
  places: Partial<PlaceAttributes>[],
  attributes: Array<keyof PlaceAttributes>,
  pgm: MigrationBuilder
) {
  if (places.length > 0) {
    const newPlaces = await createPlaceFromDefaultPlaces(places)
    newPlaces.forEach((place) => {
      const keys = attributes
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

/** @deprecated */
async function updatePlacesWithEntityScenes(
  places: Partial<PlaceAttributes>[],
  attributes: Array<keyof PlaceAttributes>,
  pgm: MigrationBuilder
) {
  if (places.length > 0) {
    const updatePlaces = await createPlaceFromDefaultPlaces(places)
    updatePlaces.forEach((place) => {
      const keys = attributes
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

/** @deprecated */
async function deletePlacesWithEntityScenes(
  places: string[],
  pgm: MigrationBuilder
) {
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
  attributes: Array<keyof PlaceAttributes>,
  pgm: MigrationBuilder
): Promise<void> {
  await validateMigratedPlaces(defaultPlaces)

  await insertPlacesWithEntityScenes(defaultPlaces.create, attributes, pgm)
  await updatePlacesWithEntityScenes(defaultPlaces.update, attributes, pgm)
  await deletePlacesWithEntityScenes(defaultPlaces.delete, pgm)
}

export async function down(
  defaultPlaces: PlacesStatic,
  attributes: Array<keyof PlaceAttributes>,
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

  await deletePlacesWithEntityScenes(placesToRestore.delete, pgm)
  await insertPlacesWithEntityScenes(placesToRestore.create, attributes, pgm)
}

/** @deprecated */
export function createPlaceMigration(
  defaultPlaces: PlacesStatic,
  attributes: Array<keyof PlaceAttributes>
) {
  return {
    up: async (pgm: MigrationBuilder) => up(defaultPlaces, attributes, pgm),
    down: async (pgm: MigrationBuilder) => down(defaultPlaces, attributes, pgm),
  }
}
