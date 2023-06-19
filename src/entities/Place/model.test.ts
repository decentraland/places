import { userLikeTrue } from "../../__data__/entities"
import { hotSceneGenesisPlaza } from "../../__data__/hotSceneGenesisPlaza"
import { placeGenesisPlaza } from "../../__data__/placeGenesisPlaza"
import { placeGenesisPlazaWithAggregatedAttributes } from "../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import { worldPlaceParalax } from "../../__data__/world"
import PlaceModel from "./model"
import { PlaceAttributes } from "./types"

const placesAttributes: Array<keyof PlaceAttributes> = [
  "title",
  "description",
  "image",
  "owner",
  "tags",
  "positions",
  "base_position",
  "contact_name",
  "contact_email",
  "content_rating",
  "disabled",
  "disabled_at",
  "created_at",
  "updated_at",
  "deployed_at",
  "categories",
  "world",
  "world_name",
  "hidden",
]

const namedQuery = jest.spyOn(PlaceModel, "namedQuery")
const updateTo = jest.spyOn(PlaceModel, "updateTo")
const namedRowCount = jest.spyOn(PlaceModel, "namedRowCount")

beforeEach(() => {
  namedQuery.mockReset()
  namedRowCount.mockReset()
})

describe(`findEnabledByPositions`, () => {
  test(`should return an empty list if receive an empty list`, async () => {
    namedQuery.mockResolvedValue([])
    expect(await PlaceModel.findEnabledByPositions([])).toEqual([])
    expect(namedQuery.mock.calls.length).toBe(0)
  })
  test(`should return a list of places matching the parameters sent`, async () => {
    namedQuery.mockResolvedValue([placeGenesisPlaza])
    expect(await PlaceModel.findEnabledByPositions(["-9,-9"])).toEqual([
      placeGenesisPlaza,
    ])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_enabled_by_positions")
    expect(sql.values).toEqual(["-9,-9"])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT * FROM "places"
        WHERE "disabled" is false
          AND "world" is false
          AND "base_position" IN (
            SELECT DISTINCT("base_position") FROM "place_positions" "pp" WHERE "pp"."position" IN ($1)
          )
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
})

describe(`findEnabledWorldName`, () => {
  test(`should return a list of places matching the parameters sent`, async () => {
    namedQuery.mockResolvedValue([worldPlaceParalax])
    expect(await PlaceModel.findEnabledWorldName("paralax.dcl.eth")).toEqual([
      worldPlaceParalax,
    ])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_enabled_by_world_name")
    expect(sql.values).toEqual(["paralax.dcl.eth"])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT * FROM "places"
        WHERE "disabled" is false AND "world" is true
          AND "world_name" = $1
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
})

describe(`findByIdWithAggregates`, () => {
  test(`should return a place matching the id`, async () => {
    namedQuery.mockResolvedValue([placeGenesisPlaza])
    expect(
      await PlaceModel.findByIdWithAggregates(placeGenesisPlaza.id, {
        user: undefined,
      })
    ).toEqual(placeGenesisPlaza)
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_by_id_with_agregates")
    expect(sql.values).toEqual([placeGenesisPlaza.id])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT p.* , false as user_favorite , false as "user_like" ,
        false as "user_dislike"
        FROM "places" p
        WHERE "p"."id" = $1
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
  test(`should return a place matching the id and user id`, async () => {
    namedQuery.mockResolvedValue([placeGenesisPlaza])
    expect(
      await PlaceModel.findByIdWithAggregates(placeGenesisPlaza.id, {
        user: userLikeTrue.user,
      })
    ).toEqual(placeGenesisPlaza)
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_by_id_with_agregates")
    expect(sql.values).toEqual([
      userLikeTrue.user,
      userLikeTrue.user,
      placeGenesisPlaza.id,
    ])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT p.* , uf."user" is not null as user_favorite ,
          coalesce(ul."like",false) as "user_like" ,
          not coalesce(ul."like",true) as "user_dislike"
        FROM "places" p
        LEFT JOIN "user_favorites" uf on p.id = uf.place_id AND uf."user" = $1
        LEFT JOIN "user_likes" ul on p.id = ul.place_id AND ul."user" = $2
        WHERE "p"."id" = $3
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
})

describe(`findWithAggregates`, () => {
  test(`should return a list of places matching the parameters FindWithAggregatesOptions without user`, async () => {
    namedQuery.mockResolvedValue([placeGenesisPlazaWithAggregatedAttributes])
    expect(
      await PlaceModel.findWithAggregates({
        offset: 0,
        limit: 1,
        only_favorites: false,
        only_featured: false,
        only_highlighted: false,
        positions: ["-9,-9"],
        order_by: "created_at",
        order: "desc",
      })
    ).toEqual([placeGenesisPlazaWithAggregatedAttributes])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_with_agregates")
    expect(sql.values).toEqual(["-9,-9", 1, 0])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT p.* , false as user_favorite , false as "user_like" , false as "user_dislike"
        FROM "places" p
        WHERE
          p."disabled" is false
          AND "world" is false
          AND p.base_position IN (
            SELECT DISTINCT(base_position) FROM "place_positions" WHERE position IN ($1)
          )
        ORDER BY p.like_rate DESC
          LIMIT $2
          OFFSET $3
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
  test(`should return a list of places matching the parameters FindWithAggregatesOptions`, async () => {
    namedQuery.mockResolvedValue([placeGenesisPlazaWithAggregatedAttributes])
    expect(
      await PlaceModel.findWithAggregates({
        offset: 0,
        limit: 1,
        only_favorites: false,
        only_featured: false,
        only_highlighted: false,
        positions: ["-9,-9"],
        order_by: "created_at",
        order: "desc",
        user: userLikeTrue.user,
      })
    ).toEqual([placeGenesisPlazaWithAggregatedAttributes])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_with_agregates")
    expect(sql.values).toEqual([
      userLikeTrue.user,
      userLikeTrue.user,
      "-9,-9",
      1,
      0,
    ])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT p.* , uf."user" is not null as user_favorite , coalesce(ul."like",false) as "user_like" ,
          not coalesce(ul."like",true) as "user_dislike"
        FROM "places" p
        LEFT JOIN "user_favorites" uf on p.id = uf.place_id AND uf."user" = $1
        LEFT JOIN "user_likes" ul on p.id = ul.place_id AND ul."user" = $2
        WHERE p."disabled" is false AND "world" is false AND p.base_position IN (
          SELECT DISTINCT(base_position) FROM "place_positions" WHERE position IN ($3)
        )
        ORDER BY p.like_rate DESC
          LIMIT $4
          OFFSET $5
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
  test(`should return a list of places matching the parameters FindWithAggregatesOptions with limit of more than 100`, async () => {
    namedQuery.mockResolvedValue([placeGenesisPlazaWithAggregatedAttributes])
    expect(
      await PlaceModel.findWithAggregates({
        offset: 0,
        limit: 1000,
        only_favorites: false,
        only_featured: false,
        only_highlighted: false,
        positions: ["-9,-9"],
        order_by: "created_at",
        order: "desc",
        user: userLikeTrue.user,
      })
    ).toEqual([placeGenesisPlazaWithAggregatedAttributes])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_with_agregates")
    expect(sql.values).toEqual([
      userLikeTrue.user,
      userLikeTrue.user,
      "-9,-9",
      100,
      0,
    ])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT p.* , uf."user" is not null as user_favorite , coalesce(ul."like",false) as "user_like" ,
          not coalesce(ul."like",true) as "user_dislike"
        FROM "places" p
        LEFT JOIN "user_favorites" uf on p.id = uf.place_id AND uf."user" = $1
        LEFT JOIN "user_likes" ul on p.id = ul.place_id AND ul."user" = $2
        WHERE p."disabled" is false AND "world" is false AND p.base_position IN (
          SELECT DISTINCT(base_position) FROM "place_positions" WHERE position IN ($3)
        )
        ORDER BY p.like_rate DESC
          LIMIT $4
          OFFSET $5
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
})

describe(`countPlaces`, () => {
  test(`should return the total number of places matching the parameters FindWithAggregatesOptions without user`, async () => {
    namedQuery.mockResolvedValue([{ total: 1 }])
    expect(
      await PlaceModel.countPlaces({
        only_favorites: false,
        only_featured: false,
        only_highlighted: false,
        positions: ["-9,-9"],
      })
    ).toEqual(1)
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("count_places")
    expect(sql.values).toEqual(["-9,-9"])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT
          count(*) as "total"
        FROM "places" p
        WHERE
          p."disabled" is false
          AND "world" is false
          AND p.base_position IN (
            SELECT DISTINCT(base_position) FROM "place_positions" WHERE position IN ($1)
          )
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
  test(`should return the total number of places matching the parameters FindWithAggregatesOptions with wrong user address`, async () => {
    namedQuery.mockResolvedValue([placeGenesisPlazaWithAggregatedAttributes])
    expect(
      await PlaceModel.countPlaces({
        only_favorites: false,
        only_featured: false,
        only_highlighted: false,
        positions: ["-9,-9"],
        user: "ABC",
      })
    ).toEqual(0)
    expect(namedQuery.mock.calls.length).toBe(0)
  })
})

describe(`disablePlaces`, () => {
  test(`should run an update query and return how many records were updated`, async () => {
    updateTo.mockResolvedValueOnce(1)
    expect(await PlaceModel.disablePlaces([placeGenesisPlaza.id])).toBe(1)
    expect(updateTo.mock.calls.length).toBe(1)
  })
})

describe(`updateFavorites`, () => {
  test(`should update favorites of a place`, async () => {
    namedQuery.mockResolvedValue([])
    expect(await PlaceModel.updateFavorites(placeGenesisPlaza.id)).toEqual([])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("update_favorites")
    expect(sql.values).toEqual([placeGenesisPlaza.id, placeGenesisPlaza.id])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        WITH counted AS (
          SELECT count(*) AS count
          FROM "user_favorites"
          WHERE "place_id" = $1
        )
        UPDATE "places"
          SET "favorites" = c.count
          FROM counted c
          WHERE "id" = $2
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
})

describe(`updateLikes`, () => {
  test(`should update likes of a place`, async () => {
    namedQuery.mockResolvedValue([])
    expect(await PlaceModel.updateLikes(placeGenesisPlaza.id)).toEqual([])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("update_likes")
    expect(sql.values).toEqual([
      100,
      100,
      placeGenesisPlaza.id,
      placeGenesisPlaza.id,
    ])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        WITH counted AS (
          SELECT
            count(*) filter (where "like") as count_likes,
            count(*) filter (where not "like") as count_dislikes,
            count(*) filter (where "user_activity" >= $1) as count_active_total,
            count(*) filter (where "like" and "user_activity" >= $2) as count_active_likes
          FROM "user_likes"
          WHERE "place_id" = $3
        )
        UPDATE "places"
          SET
            "likes" = c.count_likes,
            "dislikes" = c.count_dislikes,
            "like_rate" = (CASE WHEN c.count_active_total::float = 0 THEN 0
                                ELSE c.count_active_likes / c.count_active_total::float
                          END)
          FROM counted c
          WHERE "id" = $4
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
})

describe(`findWithHotScenes`, () => {
  test(`should return a list of places matching the parameters FindWithAggregatesOptions without user`, async () => {
    namedQuery.mockResolvedValue([placeGenesisPlazaWithAggregatedAttributes])
    expect(
      await PlaceModel.findWithHotScenes(
        {
          offset: 0,
          limit: 1,
          only_favorites: false,
          only_featured: false,
          only_highlighted: false,
          positions: ["-9,-9"],
          order_by: "created_at",
          order: "desc",
        },
        [hotSceneGenesisPlaza]
      )
    ).toEqual([
      {
        ...placeGenesisPlazaWithAggregatedAttributes,
        user_count: hotSceneGenesisPlaza.usersTotalCount,
      },
    ])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_with_agregates")
    expect(sql.values).toEqual(["-9,-9", 100, 0])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT p.* , false as user_favorite , false as "user_like" , false as "user_dislike"
        FROM "places" p
        WHERE
          p."disabled" is false AND "world" is false
          AND p.base_position IN (
            SELECT DISTINCT(base_position) FROM "place_positions" WHERE position IN ($1)
          )
        ORDER BY p.like_rate DESC
          LIMIT $2
          OFFSET $3
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
})

describe(`insertPlace`, () => {
  test(`should insert a place`, async () => {
    namedQuery.mockResolvedValue([])
    expect(
      await PlaceModel.insertPlace(placeGenesisPlaza, placesAttributes)
    ).toEqual([])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("insert_place")
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
      INSERT INTO "places" ("title", "description", "image", "owner", "tags", "positions", "base_position", "contact_name", "contact_email", "content_rating", "disabled", "disabled_at", "created_at", "updated_at", "deployed_at", "categories", "world", "world_name", "hidden", "id") 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
})

describe(`updatePlace`, () => {
  test(`should update a place`, async () => {
    namedQuery.mockResolvedValue([])
    expect(
      await PlaceModel.updatePlace(placeGenesisPlaza, placesAttributes)
    ).toEqual([])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("update_place")
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
      UPDATE "places" SET "title" = $1, "description" = $2, "image" = $3, "owner" = $4, "tags" = $5, "positions" = $6, "base_position" = $7, "contact_name" = $8, "contact_email" = $9, "content_rating" = $10, "disabled" = $11, "disabled_at" = $12, "updated_at" = $13, "deployed_at" = $14, "categories" = $15, "world" = $16, "world_name" = $17, "hidden" = $18 
      WHERE disabled is false AND world is false AND "base_position" IN 
      ( 
        SELECT DISTINCT("base_position") 
        FROM "place_positions" "pp" WHERE "pp"."position" = $19 
      )
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
})

describe(`updateWorldsShown`, () => {
  test(`should not update a empty list`, async () => {
    namedRowCount.mockResolvedValue(0)
    expect(
      await PlaceModel.updateIndexWorlds([
        {
          dclName: "paralax.dcl.eth",
          shouldBeIndexed: true,
        },
      ])
    ).toEqual(0)
    expect(namedQuery.mock.calls.length).toBe(0)
  })
  test(`should update a list of world's names`, async () => {
    namedRowCount.mockResolvedValue(1)
    expect(
      await PlaceModel.updateIndexWorlds([
        {
          dclName: "paralax.dcl.eth",
          shouldBeIndexed: true,
        },
      ])
    ).toEqual(1)
    expect(namedRowCount.mock.calls.length).toBe(1)
    const [name, sql] = namedRowCount.mock.calls[0]
    expect(name).toBe("update_index_world")
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        UPDATE "places" SET hidden = (world_name not in ($1)), 
          updated_at = now() 
        WHERE world is true 
          AND world_name IN ($2)
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
})
