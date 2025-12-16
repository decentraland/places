import {
  createDeleteQuery,
  createInsertQuery,
  createPlaceFromDefaultPlaces,
  createPlaceFromEntityScene,
  createUpdatePlacesAndWorldsQuery,
  createUpdateQuery,
  validatePlacesWorlds,
} from "./migration"
import { PlaceAttributes } from "./types"
import { entitySceneGenesisPlaza } from "../../__data__/entitySceneGenesisPlaza"
import { placeGenesisPlaza } from "../../__data__/placeGenesisPlaza"

export const attributes: Array<keyof PlaceAttributes> = [
  "title",
  "description",
  "image",
  "highlighted_image",
  "owner",
  "positions",
  "base_position",
  "world_name",
  "contact_name",
  "contact_email",
  "content_rating",
  "highlighted",
  "disabled",
  "disabled_at",
  "creator_address",
]

test("silly test", () => {
  expect(true).toBe(true)
})

describe("validatePlacesWorlds", () => {
  test("should return undefined if non of the places to import have base_position and world_name at the same tiem", async () => {
    const validatePlacesWorldsResult = validatePlacesWorlds([
      {
        base_position: "0,0",
      },
      {
        world_name: "paralax.dcl.eth",
      },
    ])
    expect(validatePlacesWorldsResult).toBeUndefined()
  })

  test("should return throw an error if any of the places to import have base_position and world_name at the same tiem", async () => {
    await expect(async () =>
      validatePlacesWorlds([
        {
          base_position: "0,0",
          world_name: "paralax.dcl.eth",
        },
      ])
    ).rejects.toThrowError()
  })
})

describe("createPlaceFromEntityScene", () => {
  test("should return a place with the correct data", async () => {
    const place = createPlaceFromEntityScene(entitySceneGenesisPlaza, {
      base_position: "-9,-9",
    })
    expect({ ...place, deployed_at: placeGenesisPlaza.deployed_at }).toEqual({
      ...placeGenesisPlaza,
      id: place.id,
      created_at: place.created_at,
      updated_at: place.updated_at,
      highlighted_image: place.highlighted_image,
    })
  })
  test("should return a place with the correct data with contact_name = author-name", async () => {
    const place = createPlaceFromEntityScene(
      {
        ...entitySceneGenesisPlaza,
        metadata: {
          ...entitySceneGenesisPlaza.metadata,
          contact: {
            ...entitySceneGenesisPlaza.metadata.contact,
            name: "author-name",
          },
        },
      },
      {
        base_position: "-9,-9",
      }
    )
    expect({ ...place, deployed_at: placeGenesisPlaza.deployed_at }).toEqual({
      ...placeGenesisPlaza,
      id: place.id,
      contact_name: null,
      created_at: place.created_at,
      updated_at: place.updated_at,
      highlighted_image: place.highlighted_image,
    })
  })
})

describe("createInsertQuery", () => {
  test("should return a query with the correct query string", async () => {
    const query = createInsertQuery(attributes)
    const insertQuery =
      "INSERT INTO places \
      (title,description,image,highlighted_image,owner,positions,\
        base_position,world_name,contact_name,contact_email,content_rating,highlighted,disabled,disabled_at,creator_address) \
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)"
    expect(query.replace(/\n|\r|\s/g, "")).toEqual(
      insertQuery.replace(/\n|\r|\s/g, "")
    )
  })
})

describe("createUpdateQuery", () => {
  test("should return a query with the correct query string", async () => {
    const query = createUpdateQuery("-9,-9", attributes)
    const updateQuery =
      "UPDATE places SET \
       title=$1, description=$2, image=$3, highlighted_image=$4, owner=$5, positions=$6, \
       base_position=$7, world_name=$8, contact_name=$9, contact_email=$10, content_rating=$11, highlighted=$12, \
       disabled=$13, disabled_at=$14, creator_address=$15 \
       WHERE positions &&'{\"-9,-9\"}'"
    expect(query.replace(/\n|\r|\s/g, "")).toEqual(
      updateQuery.replace(/\n|\r|\s/g, "")
    )
  })
})

describe("createDeleteQuery", () => {
  test("should return a query with the correct query string", async () => {
    const query = createDeleteQuery(["-9,-9", "-10,-10"])
    const deleteQuery =
      'DELETE FROM places WHERE positions && \'{"-9,-9","-10,-10"}\''
    expect(query.replace(/\n|\r|\s/g, "")).toEqual(
      deleteQuery.replace(/\n|\r|\s/g, "")
    )
  })
})

describe("createUpdatePlacesAndWorldsQuery", () => {
  test("should return a query with the correct query string for updating a Place", async () => {
    const place = {
      base_position: "-9,-9",
    }
    const keys = attributes.filter((attr) => attr in place)
    const query = createUpdatePlacesAndWorldsQuery(place, keys)
    const deleteQuery =
      "UPDATE places SET base_position=$1 WHERE '-9,-9' = ANY(\"positions\")"
    expect(query.replace(/\n|\r|\s/g, "")).toEqual(
      deleteQuery.replace(/\n|\r|\s/g, "")
    )
  })
  test("should return a query with the correct query string for updating a World", async () => {
    const place = {
      world_name: "paralax.dcl.eth",
    }
    const keys = attributes.filter((attr) => attr in place)
    const query = createUpdatePlacesAndWorldsQuery(place, keys)
    const deleteQuery =
      "UPDATE places SET world_name=$1 WHERE LOWER(world_name) = 'paralax.dcl.eth' and world is true"
    expect(query.replace(/\n|\r|\s/g, "")).toEqual(
      deleteQuery.replace(/\n|\r|\s/g, "")
    )
  })
})

describe("createPlaceFromDefaultPlaces", () => {
  test("should return a place", async () => {
    const data = await createPlaceFromDefaultPlaces([
      { base_position: "-9,-9" },
    ])

    expect(data).toEqual([
      {
        ...placeGenesisPlaza,
        contact_name: data[0].contact_name,
        created_at: data[0].created_at,
        updated_at: data[0].updated_at,
        deployed_at: data[0].deployed_at,
        image: data[0].image,
        id: data[0].id,
      },
    ])
  })
})
