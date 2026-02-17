import PlaceModel from "./model"
import { PlaceAttributes } from "./types"
import { userLikeTrue } from "../../__data__/entities"
import { hotSceneGenesisPlaza } from "../../__data__/hotSceneGenesisPlaza"
import { placeGenesisPlaza } from "../../__data__/placeGenesisPlaza"
import { placeGenesisPlazaWithAggregatedAttributes } from "../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import { worldPlaceParalax } from "../../__data__/world"

const placesAttributes: Array<keyof PlaceAttributes> = [
  "title",
  "description",
  "image",
  "owner",
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
  "world",
  "world_name",
  "creator_address",
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
    expect(await PlaceModel.findEnabledByPositions(["0,0"])).toEqual([
      placeGenesisPlaza,
    ])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_enabled_by_positions")
    expect(sql.values).toEqual(["0,0"])
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
        LEFT JOIN "user_favorites" uf on p.id = uf.entity_id AND uf."user" = $1
        LEFT JOIN "user_likes" ul on p.id = ul.entity_id AND ul."user" = $2
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
        only_highlighted: false,
        positions: ["0,0"],
        order_by: "created_at",
        order: "desc",
        search: "",
        categories: [],
      })
    ).toEqual([placeGenesisPlazaWithAggregatedAttributes])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_with_agregates")
    expect(sql.values).toEqual(["0,0", 1, 0])
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
        ORDER BY p.created_at DESC NULLS LAST, p."deployed_at" DESC
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
        only_highlighted: false,
        positions: ["0,0"],
        order_by: "created_at",
        order: "desc",
        user: userLikeTrue.user,
        search: "",
        categories: [],
      })
    ).toEqual([placeGenesisPlazaWithAggregatedAttributes])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_with_agregates")
    expect(sql.values).toEqual([
      userLikeTrue.user,
      userLikeTrue.user,
      "0,0",
      1,
      0,
    ])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT p.* , uf."user" is not null as user_favorite , coalesce(ul."like",false) as "user_like" ,
          not coalesce(ul."like",true) as "user_dislike"
        FROM "places" p
        LEFT JOIN "user_favorites" uf on p.id = uf.entity_id AND uf."user" = $1
        LEFT JOIN "user_likes" ul on p.id = ul.entity_id AND ul."user" = $2
        WHERE p."disabled" is false AND "world" is false AND p.base_position IN (
          SELECT DISTINCT(base_position) FROM "place_positions" WHERE position IN ($3)
        )
        ORDER BY p.created_at DESC NULLS LAST, p."deployed_at" DESC
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
        only_highlighted: false,
        positions: ["0,0"],
        order_by: "created_at",
        order: "desc",
        user: userLikeTrue.user,
        search: "decentraland atlas",
        categories: [],
      })
    ).toEqual([placeGenesisPlazaWithAggregatedAttributes])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_with_agregates")
    expect(sql.values).toEqual([
      userLikeTrue.user,
      userLikeTrue.user,
      "decentraland:*&atlas:*",
      "0,0",
      100,
      0,
    ])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT p.* , uf."user" is not null as user_favorite , coalesce(ul."like",false) as "user_like" ,
          not coalesce(ul."like",true) as "user_dislike"
          , rank
        FROM "places" p
        LEFT JOIN "user_favorites" uf on p.id = uf.entity_id AND uf."user" = $1
        LEFT JOIN "user_likes" ul on p.id = ul.entity_id AND ul."user" = $2
        , ts_rank_cd(p.textsearch, to_tsquery($3)) as rank
        WHERE p."disabled" is false AND "world" is false AND rank > 0 AND p.base_position IN (
          SELECT DISTINCT(base_position) FROM "place_positions" WHERE position IN ($4)
        )
        ORDER BY rank DESC,
          p.created_at DESC NULLS LAST, p."deployed_at" DESC
          LIMIT $5
          OFFSET $6
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })

  test(`should return an empty list of places when FindWithAggregatesOptions search isn't long enough`, async () => {
    namedQuery.mockResolvedValue([placeGenesisPlazaWithAggregatedAttributes])
    expect(
      await PlaceModel.findWithAggregates({
        offset: 0,
        limit: 1000,
        only_favorites: false,
        only_highlighted: false,
        positions: ["0,0"],
        order_by: "created_at",
        order: "desc",
        user: userLikeTrue.user,
        search: "de",
        categories: [],
      })
    ).toEqual([])
    expect(namedQuery.mock.calls.length).toBe(0)
  })

  test(`should return a list of places matching the parameters FindWithAggregatesOptions with owner filter`, async () => {
    namedQuery.mockResolvedValue([placeGenesisPlazaWithAggregatedAttributes])
    expect(
      await PlaceModel.findWithAggregates({
        offset: 0,
        limit: 1,
        only_favorites: false,
        only_highlighted: false,
        positions: ["0,0"],
        order_by: "created_at",
        order: "desc",
        user: userLikeTrue.user,
        search: "",
        categories: [],
        owner: "0x1234567890123456789012345678901234567890",
      })
    ).toEqual([placeGenesisPlazaWithAggregatedAttributes])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_with_agregates")
    expect(sql.values).toEqual([
      userLikeTrue.user,
      userLikeTrue.user,
      "0,0",
      "0x1234567890123456789012345678901234567890",
      1,
      0,
    ])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT p.* , uf."user" is not null as user_favorite , coalesce(ul."like",false) as "user_like" ,
          not coalesce(ul."like",true) as "user_dislike"
        FROM "places" p
        LEFT JOIN "user_favorites" uf on p.id = uf.entity_id AND uf."user" = $1
        LEFT JOIN "user_likes" ul on p.id = ul.entity_id AND ul."user" = $2
        WHERE p."disabled" is false AND "world" is false AND p.base_position IN (
          SELECT DISTINCT(base_position) FROM "place_positions" WHERE position IN ($3)
        ) AND (LOWER(p.owner) = $4 )
        ORDER BY p.created_at DESC NULLS LAST, p."deployed_at" DESC
          LIMIT $5
          OFFSET $6
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })

  test(`should return a list of places matching the parameters FindWithAggregatesOptions with owner and operatedPositions filter`, async () => {
    namedQuery.mockResolvedValue([placeGenesisPlazaWithAggregatedAttributes])
    expect(
      await PlaceModel.findWithAggregates({
        offset: 0,
        limit: 1,
        only_favorites: false,
        only_highlighted: false,
        positions: ["0,0"],
        order_by: "created_at",
        order: "desc",
        user: userLikeTrue.user,
        search: "",
        categories: [],
        owner: "0x1234567890123456789012345678901234567890",
        operatedPositions: ["12,14", "-4,34"],
      })
    ).toEqual([placeGenesisPlazaWithAggregatedAttributes])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_with_agregates")
    expect(sql.values).toEqual([
      userLikeTrue.user,
      userLikeTrue.user,
      "0,0",
      "0x1234567890123456789012345678901234567890",
      "12,14",
      "-4,34",
      1,
      0,
    ])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT p.* , uf."user" is not null as user_favorite , coalesce(ul."like",false) as "user_like" ,
          not coalesce(ul."like",true) as "user_dislike"
        FROM "places" p
        LEFT JOIN "user_favorites" uf on p.id = uf.entity_id AND uf."user" = $1
        LEFT JOIN "user_likes" ul on p.id = ul.entity_id AND ul."user" = $2
        WHERE p."disabled" is false AND "world" is false AND p.base_position IN (
          SELECT DISTINCT(base_position) FROM "place_positions" WHERE position IN ($3)
        ) AND (LOWER(p.owner) = $4 OR p.base_position IN (
          SELECT DISTINCT(base_position)
          FROM "place_positions"
          WHERE position IN ($5, $6)
        ))
        ORDER BY p.created_at DESC NULLS LAST, p."deployed_at" DESC
          LIMIT $7
          OFFSET $8
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })

  test(`should return a list of places matching the parameters FindWithAggregatesOptions with ids filter`, async () => {
    namedQuery.mockResolvedValue([placeGenesisPlazaWithAggregatedAttributes])
    expect(
      await PlaceModel.findWithAggregates({
        offset: 0,
        limit: 1,
        only_favorites: false,
        only_highlighted: false,
        positions: ["0,0"],
        order_by: "created_at",
        order: "desc",
        user: userLikeTrue.user,
        search: "",
        categories: [],
        ids: [placeGenesisPlaza.id],
      })
    ).toEqual([placeGenesisPlazaWithAggregatedAttributes])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_with_agregates")
    expect(sql.values).toEqual([
      userLikeTrue.user,
      userLikeTrue.user,
      "0,0",
      placeGenesisPlaza.id,
      1,
      0,
    ])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT p.* , uf."user" is not null as user_favorite , coalesce(ul."like",false) as "user_like" ,
          not coalesce(ul."like",true) as "user_dislike"
        FROM "places" p
        LEFT JOIN "user_favorites" uf on p.id = uf.entity_id AND uf."user" = $1
        LEFT JOIN "user_likes" ul on p.id = ul.entity_id AND ul."user" = $2
        WHERE p."disabled" is false AND p.base_position IN (
          SELECT DISTINCT(base_position) FROM "place_positions" WHERE position IN ($3)
        ) AND p.id IN ($4)
        ORDER BY p.created_at DESC NULLS LAST, p."deployed_at" DESC
          LIMIT $5
          OFFSET $6
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
        only_highlighted: false,
        positions: ["0,0"],
        search: "",
        categories: [],
      })
    ).toEqual(1)
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("count_places")
    expect(sql.values).toEqual(["0,0"])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT count(DISTINCT sub.id) as "total"
        FROM (
          SELECT p.id
          FROM "places" p
          WHERE
            p."disabled" is false
            AND "world" is false
            AND p.base_position IN (
              SELECT DISTINCT(base_position) FROM "place_positions" WHERE position IN ($1)
            )
        ) sub
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
  test(`should return the total number of places matching the parameters FindWithAggregatesOptions with search`, async () => {
    namedQuery.mockResolvedValue([{ total: 1 }])
    expect(
      await PlaceModel.countPlaces({
        only_favorites: false,
        only_highlighted: false,
        positions: ["0,0"],
        search: "decentraland atlas",
        categories: [],
      })
    ).toEqual(1)
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("count_places")
    expect(sql.values).toEqual(["decentraland:*&atlas:*", "0,0"])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT count(DISTINCT sub.id) as "total"
        FROM (
          SELECT p.id
          FROM "places" p
          , ts_rank_cd(p.textsearch, to_tsquery($1)) as rank
          WHERE
            p."disabled" is false
            AND "world" is false
            AND rank > 0
            AND p.base_position IN (
              SELECT DISTINCT(base_position) FROM "place_positions" WHERE position IN ($2)
            )
        ) sub
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
        only_highlighted: false,
        positions: ["0,0"],
        user: "ABC",
        search: "asdads",
        categories: [],
      })
    ).toEqual(0)
    expect(namedQuery.mock.calls.length).toBe(0)
  })
  test("should return 0 is the search is not long enough", async () => {
    expect(
      await PlaceModel.countPlaces({
        only_favorites: false,
        only_highlighted: false,
        positions: ["0,0"],
        user: "ABC",
        search: "",
        categories: [],
      })
    ).toEqual(0)
  })
  test(`should return the total number of places matching the parameters FindWithAggregatesOptions with owner filter`, async () => {
    namedQuery.mockResolvedValue([{ total: 1 }])
    expect(
      await PlaceModel.countPlaces({
        only_favorites: false,
        only_highlighted: false,
        positions: ["0,0"],
        search: "",
        categories: [],
        owner: "0x1234567890123456789012345678901234567890",
      })
    ).toEqual(1)
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("count_places")
    expect(sql.values).toEqual([
      "0,0",
      "0x1234567890123456789012345678901234567890",
    ])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT count(DISTINCT sub.id) as "total"
        FROM (
          SELECT p.id
          FROM "places" p
          WHERE
            p."disabled" is false
            AND "world" is false
            AND p.base_position IN (
              SELECT DISTINCT(base_position) FROM "place_positions" WHERE position IN ($1)
            )
            AND (LOWER(p.owner) = $2 )
        ) sub
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })

  test(`should return the total number of places matching the parameters FindWithAggregatesOptions with owner and operatedPositions filter`, async () => {
    namedQuery.mockResolvedValue([{ total: 1 }])
    expect(
      await PlaceModel.countPlaces({
        only_favorites: false,
        only_highlighted: false,
        positions: ["0,0"],
        search: "",
        categories: [],
        owner: "0x1234567890123456789012345678901234567890",
        operatedPositions: ["12,14", "-4,34"],
      })
    ).toEqual(1)
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("count_places")
    expect(sql.values).toEqual([
      "0,0",
      "0x1234567890123456789012345678901234567890",
      "12,14",
      "-4,34",
    ])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT count(DISTINCT sub.id) as "total"
        FROM (
          SELECT p.id
          FROM "places" p
          WHERE
            p."disabled" is false
            AND "world" is false
            AND p.base_position IN (
              SELECT DISTINCT(base_position) FROM "place_positions" WHERE position IN ($1)
            )
            AND (LOWER(p.owner) = $2 OR p.base_position IN (
              SELECT DISTINCT(base_position)
              FROM "place_positions"
              WHERE position IN ($3, $4)
            ))
        ) sub
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
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
          WHERE entity_id = $1
        )
        UPDATE "places"
        SET favorites = c.count
        FROM counted c
        WHERE id = $2
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
            count(*) filter (where user_activity >= $1) as count_active_total,
            count(*) filter (where "like" and user_activity >= $2) as count_active_likes,
            count(*) filter (where not "like" and user_activity >= $3) as count_active_dislikes
          FROM "user_likes"
          WHERE entity_id = $4
        )
        UPDATE "places"
        SET
          likes = c.count_likes,
          dislikes = c.count_dislikes,
          like_rate = (CASE WHEN c.count_active_total::float = 0 THEN NULL
                            ELSE c.count_active_likes / c.count_active_total::float
                      END),
          like_score = (CASE WHEN (c.count_active_likes + c.count_active_dislikes > 0) THEN
            ((c.count_active_likes + 1.9208)
            / (c.count_active_likes + c.count_active_dislikes) - 1.96
            * SQRT((c.count_active_likes * c.count_active_dislikes) / (c.count_active_likes + c.count_active_dislikes) + 0.9604)
            / (c.count_active_likes + c.count_active_dislikes))
            / (1 + 3.8416 / (c.count_active_likes + c.count_active_dislikes))
          ELSE NULL END)
        FROM counted c
        WHERE id = $5
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

          only_highlighted: false,
          positions: ["0,0"],
          order_by: "created_at",
          order: "desc",
          search: "",
          categories: [],
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
    expect(sql.values).toEqual(["0,0", 100, 0])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT p.* , false as user_favorite , false as "user_like" , false as "user_dislike"
        FROM "places" p
        WHERE
          p."disabled" is false AND "world" is false
          AND p.base_position IN (
            SELECT DISTINCT(base_position) FROM "place_positions" WHERE position IN ($1)
          )
        ORDER BY p.created_at DESC NULLS LAST, p."deployed_at" DESC
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
      INSERT INTO "places" ("title", "description", "image", "owner", "positions", "base_position", "contact_name", "contact_email", "content_rating", "disabled", "disabled_at", "created_at", "updated_at", "deployed_at", "world", "world_name", "creator_address", "id") 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
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
      UPDATE "places" SET "title" = $1, "description" = $2, "image" = $3, "owner" = $4, "positions" = $5, "base_position" = $6, "contact_name" = $7, "contact_email" = $8, "content_rating" = $9, "disabled" = $10, "disabled_at" = $11, "updated_at" = $12, "deployed_at" = $13, "world" = $14, "world_name" = $15, "creator_address" = $16
      WHERE disabled is false AND world is false AND "base_position" IN 
      ( 
        SELECT DISTINCT("base_position") 
        FROM "place_positions" "pp" WHERE "pp"."position" = $17
      )
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
      INSERT INTO "places" ("title", "description", "image", "owner", "positions", "base_position", "contact_name", "contact_email", "content_rating", "disabled", "disabled_at", "created_at", "updated_at", "deployed_at", "world", "world_name", "creator_address", "id") 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
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
      UPDATE "places" SET "title" = $1, "description" = $2, "image" = $3, "owner" = $4, "positions" = $5, "base_position" = $6, "contact_name" = $7, "contact_email" = $8, "content_rating" = $9, "disabled" = $10, "disabled_at" = $11, "updated_at" = $12, "deployed_at" = $13, "world" = $14, "world_name" = $15, "creator_address" = $16
      WHERE disabled is false AND world is false AND "base_position" IN 
      ( 
        SELECT DISTINCT("base_position") 
        FROM "place_positions" "pp" WHERE "pp"."position" = $17
      )
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
})

describe(`findWithCoordinatesAggregates`, () => {
  test(`should return an empty list if search is not long enough`, async () => {
    namedQuery.mockResolvedValue([])
    expect(
      await PlaceModel.findWithCoordinatesAggregates({
        offset: 0,
        limit: 1,
        only_favorites: false,
        only_highlighted: false,
        positions: ["0,0"],
        order_by: "created_at",
        order: "desc",
        search: "de",
        categories: [],
      })
    ).toEqual([])
    expect(namedQuery.mock.calls.length).toBe(0)
  })

  test(`should return a list of places matching the parameters FindWithAggregatesOptions without user`, async () => {
    namedQuery.mockResolvedValue([placeGenesisPlazaWithAggregatedAttributes])
    expect(
      await PlaceModel.findWithCoordinatesAggregates({
        offset: 0,
        limit: 1,
        only_favorites: false,
        only_highlighted: false,
        positions: ["0,0"],
        order_by: "created_at",
        order: "desc",
        search: "",
        categories: [],
      })
    ).toEqual([placeGenesisPlazaWithAggregatedAttributes])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_with_coordinates_aggregates")
    expect(sql.values).toEqual(["0,0", 1, 0])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT p.id, p.base_position, p.positions, p.title, p.description, p.image, p.contact_name, p.categories , false as user_favorite , false as user_like , false as user_dislike
        FROM "places" p
        WHERE
          p.disabled is false 
          AND array_length(p.categories, 1) > 0
          AND world is false
          AND p.base_position IN (
            SELECT DISTINCT(base_position) FROM "place_positions" WHERE position IN ($1)
          )
        ORDER BY p.created_at DESC NULLS LAST, p.deployed_at DESC
        LIMIT $2
        OFFSET $3
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })

  test(`should return a list of places matching the parameters FindWithAggregatesOptions with user`, async () => {
    namedQuery.mockResolvedValue([placeGenesisPlazaWithAggregatedAttributes])
    expect(
      await PlaceModel.findWithCoordinatesAggregates({
        offset: 0,
        limit: 1,
        only_favorites: false,
        only_highlighted: false,
        positions: ["0,0"],
        order_by: "created_at",
        order: "desc",
        user: userLikeTrue.user,
        search: "",
        categories: [],
      })
    ).toEqual([placeGenesisPlazaWithAggregatedAttributes])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_with_coordinates_aggregates")
    expect(sql.values).toEqual([
      userLikeTrue.user,
      userLikeTrue.user,
      "0,0",
      1,
      0,
    ])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT p.id, p.base_position, p.positions, p.title, p.description, p.image, p.contact_name, p.categories , uf.user is not null as user_favorite , coalesce(ul.like,false) as user_like , not coalesce(ul.like,true) as user_dislike
        FROM "places" p
        LEFT JOIN "user_favorites" uf on p.id = uf.entity_id AND uf.user = $1
        LEFT JOIN "user_likes" ul on p.id = ul.entity_id AND ul.user = $2
        WHERE
          p.disabled is false 
          AND array_length(p.categories, 1) > 0
          AND world is false
          AND p.base_position IN (
            SELECT DISTINCT(base_position) FROM "place_positions" WHERE position IN ($3)
          )
        ORDER BY p.created_at DESC NULLS LAST, p.deployed_at DESC
        LIMIT $4
        OFFSET $5
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })

  test(`should return a list of places matching the parameters FindWithAggregatesOptions with search`, async () => {
    namedQuery.mockResolvedValue([placeGenesisPlazaWithAggregatedAttributes])
    expect(
      await PlaceModel.findWithCoordinatesAggregates({
        offset: 0,
        limit: 1,
        only_favorites: false,
        only_highlighted: false,
        positions: ["0,0"],
        order_by: "created_at",
        order: "desc",
        user: userLikeTrue.user,
        search: "decentraland atlas",
        categories: [],
      })
    ).toEqual([placeGenesisPlazaWithAggregatedAttributes])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_with_coordinates_aggregates")
    expect(sql.values).toEqual([
      userLikeTrue.user,
      userLikeTrue.user,
      "decentraland:*&atlas:*",
      "0,0",
      1,
      0,
    ])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT p.id, p.base_position, p.positions, p.title, p.description, p.image, p.contact_name, p.categories , uf.user is not null as user_favorite , coalesce(ul.like,false) as user_like , not coalesce(ul.like,true) as user_dislike
        FROM "places" p 
        LEFT JOIN "user_favorites" uf on p.id = uf.entity_id AND uf.user = $1
        LEFT JOIN "user_likes" ul on p.id = ul.entity_id AND ul.user = $2 , ts_rank_cd(p.textsearch, to_tsquery($3)) as rank
        WHERE p.disabled is false 
          AND array_length(p.categories, 1) > 0
          AND world is false
          AND rank > 0
          AND p.base_position IN (
            SELECT DISTINCT(base_position) 
            FROM "place_positions" 
            WHERE position IN ($4)
          )
        ORDER BY rank DESC, p.created_at DESC NULLS LAST, p.deployed_at DESC
        LIMIT $5
        OFFSET $6
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })

  test(`should return a list of places matching the parameters FindWithAggregatesOptions with categories`, async () => {
    namedQuery.mockResolvedValue([placeGenesisPlazaWithAggregatedAttributes])
    expect(
      await PlaceModel.findWithCoordinatesAggregates({
        offset: 0,
        limit: 1,
        only_favorites: false,
        only_highlighted: false,
        positions: ["0,0"],
        order_by: "created_at",
        order: "desc",
        user: userLikeTrue.user,
        search: "decentraland atlas",
        categories: ["art"],
      })
    ).toEqual([placeGenesisPlazaWithAggregatedAttributes])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_with_coordinates_aggregates")
    expect(sql.values).toEqual([
      userLikeTrue.user,
      userLikeTrue.user,
      "art",
      "decentraland:*&atlas:*",
      "0,0",
      1,
      0,
    ])
  })
})

describe(`countPlacesWithCoordinatesAggregates`, () => {
  test(`should return the total number of places matching the parameters FindWithAggregatesOptions without user`, async () => {
    namedQuery.mockResolvedValue([{ total: 1 }])
    expect(
      await PlaceModel.countPlacesWithCoordinatesAggregates({
        only_favorites: false,
        only_highlighted: false,
        positions: ["0,0"],
        search: "",
        categories: [],
      })
    ).toEqual(1)
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("count_places")
    expect(sql.values).toEqual(["0,0"])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT
          count(DISTINCT p.id) as "total"
        FROM "places" p
        WHERE
          p.disabled is false 
          AND array_length(p.categories, 1) > 0
          AND "world" is false
          AND p.base_position IN (
            SELECT DISTINCT(base_position) FROM "place_positions" WHERE position IN ($1)
          )
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })

  test(`should return the total number of places matching the parameters FindWithAggregatesOptions with search`, async () => {
    namedQuery.mockResolvedValue([{ total: 1 }])
    expect(
      await PlaceModel.countPlacesWithCoordinatesAggregates({
        only_favorites: false,
        only_highlighted: false,
        positions: ["0,0"],
        search: "decentraland atlas",
        categories: [],
      })
    ).toEqual(1)
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("count_places")
    expect(sql.values).toEqual(["decentraland:*&atlas:*", "0,0"])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT
          count(DISTINCT p.id) as "total"
        FROM "places" p , ts_rank_cd(p.textsearch, to_tsquery($1)) as rank
        WHERE
          p.disabled is false 
          AND array_length(p.categories, 1) > 0
          AND "world" is false
          AND p.base_position IN (
            SELECT DISTINCT(base_position) FROM "place_positions" WHERE position IN ($2)
          ) AND rank > 0
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })

  test(`should return 0 if the search is not long enough`, async () => {
    expect(
      await PlaceModel.countPlacesWithCoordinatesAggregates({
        only_favorites: false,
        only_highlighted: false,
        positions: ["0,0"],
        user: "ABC",
        search: "a",
        categories: [],
      })
    ).toEqual(0)
  })

  test(`should return 0 with wrong user address`, async () => {
    namedQuery.mockResolvedValue([placeGenesisPlazaWithAggregatedAttributes])
    expect(
      await PlaceModel.countPlacesWithCoordinatesAggregates({
        only_favorites: false,
        only_highlighted: false,
        positions: ["0,0"],
        user: "ABC",
        search: "asdkad",
        categories: [],
      })
    ).toEqual(0)
    expect(namedQuery.mock.calls.length).toBe(0)
  })
})
