import Catalyst, {
  ContentEntityScene,
} from "decentraland-gatsby/dist/utils/api/Catalyst"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import Time from "decentraland-gatsby/dist/utils/date/Time"
import { MigrationBuilder } from "node-pg-migrate"
import { v4 as uuid } from "uuid"

import getContentRating, {
  isDowngradingRating,
} from "../../utils/rating/contentRating"
import { notifyDowngradeRating } from "../Slack/utils"
import PlaceModel from "./model"
import { PlaceAttributes } from "./types"
import { getThumbnailFromDeployment } from "./utils"

export type PlacesStatic = {
  create: Array<Partial<PlaceAttributes>>
  update: Array<Partial<PlaceAttributes>>
  delete: string[]
}

export type PlacesStaticUpdate = {
  update: Array<Partial<PlaceAttributes>>
}

/** @deprecated */
export function createPlaceFromEntityScene(
  entityScene: ContentEntityScene,
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

  const contentEntitySceneRating =
    entityScene?.metadata?.policy?.contentRating ||
    SceneContentRating.RATING_PENDING
  if (
    data.content_rating &&
    isDowngradingRating(
      contentEntitySceneRating,
      data.content_rating as SceneContentRating
    )
  ) {
    notifyDowngradeRating(data as PlaceAttributes, contentEntitySceneRating)
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
    like_rate: 0.5,
    like_score: 0,
    base_position: entityScene?.metadata?.scene?.base || positions[0],
    contact_name,
    contact_email: entityScene?.metadata?.contact?.email || null,
    content_rating: getContentRating(entityScene, data),
    highlighted: false,
    highlighted_image: null,
    featured: false,
    featured_image: null,
    disabled: false,
    disabled_at:
      !!data.disabled && !data.disabled_at ? now : data.disabled_at || null,
    created_at: now,
    updated_at: now,
    deployed_at: now,
    world: false,
    world_name: null,
    hidden: false,
    ...data,
  }

  return placeParsed
}

export function validatePlacesWorlds(places: Partial<PlaceAttributes>[]) {
  if (places.length > 0) {
    const invalidWorldData = places.filter(
      (place) => place.world_name && place.base_position
    )
    if (invalidWorldData.length > 0) {
      throw new Error(
        "There is an error with places provided. Migration can't proccede. The following scene can't proccede because a base_position and world_name was provided: " +
          JSON.stringify(
            invalidWorldData.map((place) => [
              place.base_position,
              place.world_name,
            ]),
            null,
            2
          )
      )
    }
  }
}

export function createUpdatePlacesAndWorldsQuery(
  place: Partial<PlaceAttributes>,
  keys: Array<keyof PlaceAttributes>
) {
  return `UPDATE ${PlaceModel.tableName} SET ${keys
    .map((k, i) => `${k}=$${i + 1}`)
    .join(",")}  WHERE
        ${
          place.base_position
            ? `'${place.base_position}' = ANY("positions")`
            : ""
        }
        ${place.world_name ? `world_name = '${place.world_name}'` : ""}
      `
}

export async function upJustUpdateAllowed(
  defaultPlaces: PlacesStaticUpdate,
  attributes: Array<keyof PlaceAttributes>,
  pgm: MigrationBuilder
): Promise<void> {
  validatePlacesWorlds(defaultPlaces.update)

  defaultPlaces.update.forEach((place) => {
    const keys = attributes.filter((attr) => attr in place)
    pgm.db.query(
      createUpdatePlacesAndWorldsQuery(place, keys),
      keys.map((key) => place[key])
    )
  })
}

export function createPlaceNewMigrationUpdate(
  defaultPlaces: PlacesStaticUpdate,
  attributes: Array<keyof PlaceAttributes>
) {
  return {
    up: async (pgm: MigrationBuilder) =>
      upJustUpdateAllowed(defaultPlaces, attributes, pgm),
    down: async () => {},
  }
}

/**@deprecated */
async function fetchEntityScenesFromDefaultPlaces(
  places: Partial<PlaceAttributes>[]
) {
  const batch = places.map((place) => place.base_position!)
  return Catalyst.getInstance().getEntityScenes(batch)
}

/** @deprecated */
export async function createPlaceFromDefaultPlaces(
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

export function createInsertQuery(attributes: Array<keyof PlaceAttributes>) {
  const keys = attributes
  return `INSERT INTO ${PlaceModel.tableName} (${keys.join(",")})
            VALUES (${keys.map((k, i) => `$${i + 1}`).join(",")})`
}

export function createUpdateQuery(
  basePosition: string,
  attributes: Array<keyof PlaceAttributes>
) {
  const keys = attributes
  return `UPDATE ${PlaceModel.tableName} SET ${keys
    .map((k, i) => `${k}=$${i + 1}`)
    .join(",")}  WHERE positions && ${"'{\"" + basePosition + "\"}'"}`
}

export function createDeleteQuery(places: string[]) {
  return `DELETE FROM ${PlaceModel.tableName} WHERE positions && ${
    "'{" + JSON.stringify(places)?.slice(1, -1) + "}'"
  }`
}

/** @deprecated */
export async function up(
  defaultPlaces: PlacesStatic,
  attributes: Array<keyof PlaceAttributes>,
  pgm: MigrationBuilder
): Promise<void> {
  const placesToCreate = await createPlaceFromDefaultPlaces(
    defaultPlaces.create
  )

  placesToCreate.forEach(async (place) => {
    const keys = [...attributes, "id", "created_at", "updated_at"] as Array<
      keyof PlaceAttributes
    >
    pgm.db.query(
      createInsertQuery(keys),
      keys.map((key) => place[key])
    )
  })

  const placesToUpdate = await createPlaceFromDefaultPlaces(
    defaultPlaces.update
  )

  placesToUpdate.forEach((place) => {
    const keys = [...attributes, "updated_at"] as Array<keyof PlaceAttributes>
    pgm.db.query(
      createUpdateQuery(place.base_position, keys),
      keys.map((key) => place[key])
    )
  })

  defaultPlaces.delete.length &&
    pgm.db.query(createDeleteQuery(defaultPlaces.delete))
}

/** @deprecated */
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

  placesToRestore.delete.length &&
    pgm.db.query(createDeleteQuery(defaultPlaces.delete))

  const placesToCreate = await createPlaceFromDefaultPlaces(
    placesToRestore.create
  )
  placesToCreate.forEach(async (scene) => {
    const keys = [...attributes, "id", "created_at", "updated_at"] as Array<
      keyof PlaceAttributes
    >
    pgm.db.query(
      createInsertQuery(keys),
      keys.map((key) => scene[key])
    )
  })
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
