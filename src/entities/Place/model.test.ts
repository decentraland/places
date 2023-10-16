import { userLikeTrue } from "../../__data__/entities"
import { hotSceneGenesisPlaza } from "../../__data__/hotSceneGenesisPlaza"
import { placeGenesisPlaza } from "../../__data__/placeGenesisPlaza"
import { placeGenesisPlazaWithAggregatedAttributes } from "../../__data__/placeGenesisPlazaWithAggregatedAttributes"
import {
  worldPlaceParalax,
  worldPlaceParalaxWithAggregated,
  worldPlaceTemplegame,
} from "../../__data__/world"
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
        search: "",
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
        ORDER BY p.like_score DESC NULLS LAST, p."deployed_at" DESC
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
        search: "",
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
        ORDER BY p.like_score DESC NULLS LAST, p."deployed_at" DESC
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
        search: "decentraland atlas",
      })
    ).toEqual([placeGenesisPlazaWithAggregatedAttributes])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_with_agregates")
    expect(sql.values).toEqual([
      userLikeTrue.user,
      userLikeTrue.user,
      "decentraland:*&atlas:*",
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
        , ts_rank_cd(p.textsearch, to_tsquery($3)) as rank
        WHERE p."disabled" is false AND "world" is false AND rank > 0 AND p.base_position IN (
          SELECT DISTINCT(base_position) FROM "place_positions" WHERE position IN ($4)
        )
        ORDER BY rank DESC,
          p.like_score DESC NULLS LAST, p."deployed_at" DESC
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
        only_featured: false,
        only_highlighted: false,
        positions: ["-9,-9"],
        order_by: "created_at",
        order: "desc",
        user: userLikeTrue.user,
        search: "de",
      })
    ).toEqual([])
    expect(namedQuery.mock.calls.length).toBe(0)
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
        search: "",
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
  test(`should return the total number of places matching the parameters FindWithAggregatesOptions with search`, async () => {
    namedQuery.mockResolvedValue([{ total: 1 }])
    expect(
      await PlaceModel.countPlaces({
        only_favorites: false,
        only_featured: false,
        only_highlighted: false,
        positions: ["-9,-9"],
        search: "decentraland atlas",
      })
    ).toEqual(1)
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("count_places")
    expect(sql.values).toEqual(["decentraland:*&atlas:*", "-9,-9"])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT
          count(*) as "total"
        FROM "places" p , ts_rank_cd(p.textsearch, to_tsquery($1)) as rank
        WHERE
          p."disabled" is false
          AND "world" is false
          AND p.base_position IN (
            SELECT DISTINCT(base_position) FROM "place_positions" WHERE position IN ($2)
          ) AND rank > 0
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
        search: "asdads",
      })
    ).toEqual(0)
    expect(namedQuery.mock.calls.length).toBe(0)
  })
  test("should return 0 is the search is not long enough", async () => {
    expect(
      await PlaceModel.countPlaces({
        only_favorites: false,
        only_featured: false,
        only_highlighted: false,
        positions: ["-9,-9"],
        user: "ABC",
        search: "",
      })
    ).toEqual(0)
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
            count(*) filter (where "like" and "user_activity" >= $2) as count_active_likes,
            count(*) filter (where not "like" and "user_activity" >= $3) as count_active_dislikes
          FROM "user_likes"
          WHERE "place_id" = $4
        )
        UPDATE "places"
          SET
            "likes" = c.count_likes,
            "dislikes" = c.count_dislikes,
            "like_rate" = (CASE WHEN c.count_active_total::float = 0 THEN NULL
                                ELSE c.count_active_likes / c.count_active_total::float
                          END),
          "like_score" = (CASE WHEN (c.count_active_likes + c.count_active_dislikes > 0) THEN 
            ((c.count_active_likes + 1.9208) / (c.count_active_likes + c.count_active_dislikes)
             - 1.96 * SQRT((c.count_active_likes * c.count_active_dislikes) / (c.count_active_likes + c.count_active_dislikes) + 0.9604) / (c.count_active_likes + c.count_active_dislikes)) 
            / (1 + 3.8416 / (c.count_active_likes + c.count_active_dislikes)) 
            ELSE NULL END)
          FROM counted c
          WHERE "id" = $5
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
          search: "",
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
        ORDER BY p.like_score DESC NULLS LAST, p."deployed_at" DESC
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

describe(`findWorlds`, () => {
  test(`should return a list of worlds not hidden`, async () => {
    namedQuery.mockResolvedValue([worldPlaceParalaxWithAggregated])
    expect(await PlaceModel.findWorlds()).toEqual([
      worldPlaceParalaxWithAggregated,
    ])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_worlds")
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT * FROM "places"
        WHERE "world" is true and disabled is false
        ORDER BY updated_at ASC LIMIT 500
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
})

describe(`findWorld`, () => {
  test(`should return a list of worlds matching the parameters FindWorldWithAggregatesOptions without user`, async () => {
    namedQuery.mockResolvedValue([worldPlaceTemplegame])
    expect(
      await PlaceModel.findWorld({
        offset: 0,
        limit: 1,
        only_favorites: false,
        names: ["templegame.dcl.eth"],
        order_by: "created_at",
        order: "desc",
        search: "",
      })
    ).toEqual([worldPlaceTemplegame])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_worlds")
    expect(sql.values).toEqual(["templegame.dcl.eth", 1, 0])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT p.* , false as user_favorite , false as user_like , false as user_dislike
        FROM "places" p
          WHERE
            p.disabled is false
            AND world is true
            AND hidden is false
            AND world_name IN ($1)
          ORDER BY p.like_score DESC NULLS LAST, p."deployed_at" DESC
            LIMIT $2
            OFFSET $3
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
  test(`should return a list of worlds matching the parameters FindWithAggregatesOptions`, async () => {
    namedQuery.mockResolvedValue([worldPlaceTemplegame])
    expect(
      await PlaceModel.findWorld({
        offset: 0,
        limit: 1,
        only_favorites: false,
        names: ["templegame.dcl.eth"],
        order_by: "created_at",
        order: "desc",
        user: userLikeTrue.user,
        search: "decentraland",
      })
    ).toEqual([worldPlaceTemplegame])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("find_worlds")
    expect(sql.values).toEqual([
      userLikeTrue.user,
      userLikeTrue.user,
      "decentraland:*",
      "templegame.dcl.eth",
      1,
      0,
    ])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT p.* , uf.user is not null as user_favorite , coalesce(ul.like,false) as user_like , not coalesce(ul.like,true) as user_dislike
        FROM "places" p
        LEFT JOIN "user_favorites" uf on p.id = uf.place_id AND uf.user = $1
        LEFT JOIN "user_likes" ul on p.id = ul.place_id AND ul.user = $2
        , ts_rank_cd(p.textsearch, to_tsquery($3)) as rank
        WHERE
          p.disabled is false
          AND world is true
          AND hidden is false
          AND world_name IN ($4)
          AND rank > 0
        ORDER BY rank DESC, p.like_score DESC NULLS LAST, p."deployed_at" DESC
          LIMIT $5
          OFFSET $6
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
  test(`should return an empty list of worlds when search is empty`, async () => {
    namedQuery.mockResolvedValue([worldPlaceTemplegame])
    expect(
      await PlaceModel.findWorld({
        offset: 0,
        limit: 1,
        only_favorites: false,
        names: ["templegame.dcl.eth"],
        order_by: "created_at",
        order: "desc",
        user: userLikeTrue.user,
        search: "de",
      })
    ).toEqual([])
    expect(namedQuery.mock.calls.length).toBe(0)
  })
})

describe(`countWorlds`, () => {
  test(`should return the total number of worlds matching the parameters FindWorldWithAggregatesOptions without user`, async () => {
    namedQuery.mockResolvedValue([{ total: 1 }])
    expect(
      await PlaceModel.countWorlds({
        only_favorites: false,
        names: ["templegame.dcl.eth"],
        search: "",
      })
    ).toEqual(1)
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("count_worlds")
    expect(sql.values).toEqual(["templegame.dcl.eth"])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT
          count(*) as total
        FROM "places" p
        WHERE
          p.disabled is false
          AND p.world is true
          AND p.hidden is false
          AND p.world_name IN ($1)
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
  test(`should return the total number of worlds matching the parameters FindWorldWithAggregatesOptions with search without user`, async () => {
    namedQuery.mockResolvedValue([{ total: 1 }])
    expect(
      await PlaceModel.countWorlds({
        only_favorites: false,
        names: ["templegame.dcl.eth"],
        search: "decentraland",
      })
    ).toEqual(1)
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("count_worlds")
    expect(sql.values).toEqual(["decentraland:*", "templegame.dcl.eth"])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT
          count(*) as total
        FROM "places" p , ts_rank_cd(p.textsearch, to_tsquery($1)) as rank
        WHERE
          p.disabled is false
          AND p.world is true
          AND p.hidden is false
          AND p.world_name IN ($2)
          AND rank > 0
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
  test("should return 0 is the search is not long enough", async () => {
    expect(
      await PlaceModel.countWorlds({
        only_favorites: false,
        names: ["templegame.dcl.eth"],
        user: "ABC",
        search: "a",
      })
    ).toEqual(0)
  })
  test(`should return 0 with wrong user address`, async () => {
    namedQuery.mockResolvedValue([placeGenesisPlazaWithAggregatedAttributes])
    expect(
      await PlaceModel.countWorlds({
        only_favorites: false,
        names: ["templegame.dcl.eth"],
        user: "ABC",
        search: "asdkad",
      })
    ).toEqual(0)
    expect(namedQuery.mock.calls.length).toBe(0)
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
