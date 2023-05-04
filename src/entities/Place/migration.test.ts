import {
  entitySceneGenesisPlaza,
  placeGenesisPlaza,
} from "../../__data__/entities"
import {
  createDeleteQuery,
  createInsertQuery,
  createPlaceFromDefaultPlaces,
  createPlaceFromEntityScene,
  createUpdatePlacesAndWorldsQuery,
  createUpdateQuery,
  validateMigratedPlaces,
  validatePlacesWithEntityScenes,
  validatePlacesWorlds,
} from "./migration"
import { PlaceAttributes } from "./types"

export const attributes: Array<keyof PlaceAttributes> = [
  "title",
  "description",
  "image",
  "highlighted_image",
  "featured_image",
  "owner",
  "tags",
  "positions",
  "base_position",
  "world_name",
  "contact_name",
  "contact_email",
  "content_rating",
  "highlighted",
  "featured",
  "disabled",
  "disabled_at",
]

describe("validatePlacesWorlds", () => {
  test("should return undefined if non of the places to import have base_position and world_name at the same tiem", async () => {
    const validatePlacesWorldsResult = validatePlacesWorlds([
      {
        base_position: "0,0",
        featured: true,
      },
      {
        world_name: "paralax.dcl.eth",
        featured: true,
      },
    ])
    expect(validatePlacesWorldsResult).toBeUndefined()
  })

  test("should return throw an error if any of the places to import have base_position and world_name at the same tiem", async () => {
    await expect(async () =>
      validatePlacesWorlds([
        {
          base_position: "0,0",
          featured: true,
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
      featured: true,
    })
    expect({ ...place, deployed_at: placeGenesisPlaza.deployed_at }).toEqual({
      ...placeGenesisPlaza,
      id: place.id,
      featured: true,
      created_at: place.created_at,
      updated_at: place.updated_at,
      featured_image: place.featured_image,
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
        featured: true,
      }
    )
    expect({ ...place, deployed_at: placeGenesisPlaza.deployed_at }).toEqual({
      ...placeGenesisPlaza,
      id: place.id,
      featured: true,
      contact_name: null,
      created_at: place.created_at,
      updated_at: place.updated_at,
      featured_image: place.featured_image,
      highlighted_image: place.highlighted_image,
    })
  })
})

describe("createInsertQuery", () => {
  test("should return a query with the correct query string", async () => {
    const query = createInsertQuery(attributes)
    const insertQuery =
      "INSERT INTO places \
      (title,description,image,highlighted_image,featured_image,owner,tags,positions,\
        base_position,world_name,contact_name,contact_email,content_rating,highlighted,featured,disabled,disabled_at) \
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)"
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
       title=$1, description=$2, image=$3, highlighted_image=$4, featured_image=$5, owner=$6, tags=$7, positions=$8, \
       base_position=$9, world_name=$10, contact_name=$11, contact_email=$12, content_rating=$13, highlighted=$14, featured=$15, \
       disabled=$16, disabled_at=$17 \
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
      featured: true,
    }
    const keys = attributes.filter((attr) => attr in place)
    const query = createUpdatePlacesAndWorldsQuery(place, keys)
    const deleteQuery =
      "UPDATE places SET base_position=$1, featured=$2 WHERE '-9,-9' = ANY(\"positions\")"
    expect(query.replace(/\n|\r|\s/g, "")).toEqual(
      deleteQuery.replace(/\n|\r|\s/g, "")
    )
  })
  test("should return a query with the correct query string for updating a World", async () => {
    const place = {
      world_name: "paralax.dcl.eth",
      featured: true,
    }
    const keys = attributes.filter((attr) => attr in place)
    const query = createUpdatePlacesAndWorldsQuery(place, keys)
    const deleteQuery =
      "UPDATE places SET world_name=$1, featured=$2 WHERE world_name = 'paralax.dcl.eth'"
    expect(query.replace(/\n|\r|\s/g, "")).toEqual(
      deleteQuery.replace(/\n|\r|\s/g, "")
    )
  })
})

describe("validateMigratedPlaces", () => {
  test("should return true if all the places have been migrated", async () => {
    const validateMigratedPlacesResult = await validateMigratedPlaces({
      create: [
        {
          base_position: "-55,-127",
        },
        {
          base_position: "29,-88",
        },
        {
          base_position: "-104,-95",
        },
      ],
      update: [
        {
          base_position: "47,-45",
        },
      ],
      delete: ["-101,127", "-9,-9"],
    })
    expect(validateMigratedPlacesResult).toBeUndefined()
  })

  test("should return an error if the Place migration has not been created", async () => {
    expect(
      validateMigratedPlaces({
        create: [{ base_position: "-89,11" }],
        update: [],
        delete: [],
      })
    ).rejects.toThrowError()
  })

  test("should return an error if the Place migration has not been updated", async () => {
    expect(
      validateMigratedPlaces({
        create: [],
        update: [{ base_position: "-89,11" }],
        delete: [],
      })
    ).rejects.toThrowError()
  })

  test("should return an error if the Place migration has not been created", async () => {
    expect(
      validateMigratedPlaces({
        create: [],
        update: [],
        delete: ["-89,11"],
      })
    ).rejects.toThrowError()
  })
})

describe("validatePlacesWithEntityScenes", () => {
  test("should throw an error if the place is a road", async () => {
    expect(
      validatePlacesWithEntityScenes([{ base_position: "-89,11" }])
    ).rejects.toThrowError()
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
        tags: data[0].tags,
        created_at: data[0].created_at,
        updated_at: data[0].updated_at,
        deployed_at: data[0].deployed_at,
        id: data[0].id,
      },
    ])
  })
})
