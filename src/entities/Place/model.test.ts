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
  "disabled_reason",
  "created_at",
  "updated_at",
  "deployed_at",
  "world",
  "world_name",
  "creator_address",
]

const namedQuery = jest.spyOn(PlaceModel, "namedQuery")
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

  test(`should return a list of places matching the search when it contains an apostrophe`, async () => {
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
        search: "Franky's Tavern",
        categories: [],
      })
    ).toEqual([placeGenesisPlazaWithAggregatedAttributes])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [, sql] = namedQuery.mock.calls[0]
    expect(sql.values).toEqual([
      userLikeTrue.user,
      userLikeTrue.user,
      "Franky&s&Tavern:*",
      "0,0",
      1,
      0,
    ])
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
  test(`should run an update query to disable places with overwritten reason`, async () => {
    namedQuery.mockResolvedValue([])
    await PlaceModel.disablePlaces([placeGenesisPlaza.id])
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("disable_places")
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toContain(
      `"disabled_reason" = 'overwritten'`
    )
  })
})

describe("when checking for a newer active world deployment", () => {
  let deployedAt: Date

  beforeEach(() => {
    deployedAt = new Date("2026-08-05T12:00:00.000Z")
    namedQuery.mockResolvedValue([{ exists: true }])
  })

  it("should compare deployment timestamps in PostgreSQL", async () => {
    await PlaceModel.hasNewerActiveWorldDeployment(
      "example.dcl.eth",
      ["0,0"],
      deployedAt
    )
    const [, sql] = namedQuery.mock.calls[0]

    expect(sql.text.replace(/\s+/g, " ")).toContain(`AND "deployed_at" > $`)
  })
})

describe("when disabling world places replaced by a deployment", () => {
  let deployedAt: Date

  beforeEach(() => {
    deployedAt = new Date("2026-08-05T12:00:00.000Z")
    namedQuery.mockResolvedValue([worldPlaceParalax])
  })

  describe("and the replacing deployment was accepted", () => {
    it("should disable rows deployed at the same timestamp", async () => {
      await PlaceModel.disableReplacedWorldPlaces(
        [worldPlaceParalax.id],
        deployedAt,
        true
      )
      const [, sql] = namedQuery.mock.calls[0]

      expect(sql.text.replace(/\s+/g, " ")).toContain(`AND "deployed_at" <= $`)
    })
  })

  describe("and the replacing deployment was discarded", () => {
    it("should disable only strictly older rows", async () => {
      await PlaceModel.disableReplacedWorldPlaces(
        [worldPlaceParalax.id],
        deployedAt,
        false
      )
      const [, sql] = namedQuery.mock.calls[0]

      expect(sql.text.replace(/\s+/g, " ")).toContain(`AND "deployed_at" < $`)
    })

    it("should return the rows PostgreSQL actually disabled", async () => {
      const disabled = await PlaceModel.disableReplacedWorldPlaces(
        [worldPlaceParalax.id],
        deployedAt,
        false
      )

      expect(disabled).toEqual([worldPlaceParalax])
    })
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
      INSERT INTO "places" ("title", "description", "image", "owner", "positions", "base_position", "contact_name", "contact_email", "content_rating", "disabled", "disabled_at", "disabled_reason", "created_at", "updated_at", "deployed_at", "world", "world_name", "creator_address", "id")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
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
      UPDATE "places" SET "title" = $1, "description" = $2, "image" = $3, "owner" = $4, "positions" = $5, "base_position" = $6, "contact_name" = $7, "contact_email" = $8, "content_rating" = $9, "disabled" = $10, "disabled_at" = $11, "disabled_reason" = $12, "updated_at" = $13, "deployed_at" = $14, "world" = $15, "world_name" = $16, "creator_address" = $17
      WHERE disabled is false AND world is false AND "id" = $18
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
      INSERT INTO "places" ("title", "description", "image", "owner", "positions", "base_position", "contact_name", "contact_email", "content_rating", "disabled", "disabled_at", "disabled_reason", "created_at", "updated_at", "deployed_at", "world", "world_name", "creator_address", "id")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
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
      UPDATE "places" SET "title" = $1, "description" = $2, "image" = $3, "owner" = $4, "positions" = $5, "base_position" = $6, "contact_name" = $7, "contact_email" = $8, "content_rating" = $9, "disabled" = $10, "disabled_at" = $11, "disabled_reason" = $12, "updated_at" = $13, "deployed_at" = $14, "world" = $15, "world_name" = $16, "creator_address" = $17
      WHERE disabled is false AND world is false AND "id" = $18
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
})

describe(`updatePlace for world places`, () => {
  test(`should only allow updates for enabled or opt_out disabled places`, async () => {
    namedQuery.mockResolvedValue([])
    await PlaceModel.updatePlace(worldPlaceParalax, placesAttributes)
    expect(namedQuery.mock.calls.length).toBe(1)
    const [name, sql] = namedQuery.mock.calls[0]
    expect(name).toBe("update_place")
    const normalizedSql = sql.text.trim().replace(/\s{2,}/gi, " ")
    expect(normalizedSql).toContain(`world is true AND "id" = $`)
    expect(normalizedSql).toContain(
      `("disabled" IS FALSE OR "disabled_reason" = 'opt_out')`
    )
  })
})

describe("when updating a place from a deployment", () => {
  let place: PlaceAttributes

  beforeEach(() => {
    place = {
      ...worldPlaceParalax,
      deployed_at: new Date("2026-08-05T10:00:00.000Z"),
    }
    namedRowCount.mockResolvedValue(1)
  })

  it("should reject the write when the stored place holds a newer revision", async () => {
    await PlaceModel.updatePlaceFromDeployment(place, placesAttributes)

    const [, sql] = namedRowCount.mock.calls[0]
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toContain(
      `AND ("deployed_at" IS NULL OR "deployed_at" <= $`
    )
  })

  it("should return the number of rows the revision was written to", async () => {
    expect(
      await PlaceModel.updatePlaceFromDeployment(place, placesAttributes)
    ).toBe(1)
  })

  it("should keep the world guard on enabled or opt_out places", async () => {
    await PlaceModel.updatePlaceFromDeployment(place, placesAttributes)

    const [, sql] = namedRowCount.mock.calls[0]
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toContain(
      `world is true AND "id" = $`
    )
  })
})

describe("when updating a place outside a deployment", () => {
  beforeEach(() => {
    namedQuery.mockResolvedValue([])
  })

  it("should not guard the write with the deployment timestamp", async () => {
    await PlaceModel.updatePlace(placeGenesisPlaza, placesAttributes)

    const [, sql] = namedQuery.mock.calls[0]
    expect(sql.text).not.toContain(`"deployed_at" <=`)
  })
})

describe("when disabling world scenes by deployment identity", () => {
  let eventTimestamp: number
  let liveDeploymentIds: string[]
  let livePositions: string[]
  let snapshot: Array<{ id: string; deployment_id: string | null }>

  beforeEach(() => {
    eventTimestamp = Date.parse("2026-08-03T12:00:00.000Z")
    liveDeploymentIds = ["deployment-live"]
    livePositions = ["9,9"]
    snapshot = [
      { id: "11111111-1111-1111-1111-111111111111", deployment_id: null },
    ]
    namedQuery.mockResolvedValue([])
  })

  it("should match current revisions by deployment id or base and guard legacy base matches", async () => {
    await PlaceModel.disableByWorldIdAndDeployments(
      "Example.DCL.ETH",
      ["deployment-a"],
      ["1,1"],
      ["1,1", "2,1"],
      eventTimestamp,
      liveDeploymentIds,
      livePositions,
      snapshot
    )

    const [name, sql] = namedQuery.mock.calls[0]
    const normalizedSql = sql.text.trim().replace(/\s{2,}/gi, " ")
    expect({ name, normalizedSql }).toEqual({
      name: "disable_by_world_id_and_deployments",
      normalizedSql: expect.stringMatching(
        /target\."deployment_id" = ANY\(\$.*target\."positions" && \$.*::varchar\[\].*target\."base_position" = ANY\(\$.*target\."deployment_id" IS NOT NULL OR NOT EXISTS/
      ),
    })
  })

  it("should judge a row that has a deployment id against the served deployments", async () => {
    await PlaceModel.disableByWorldIdAndDeployments(
      "example.dcl.eth",
      ["deployment-a"],
      ["1,1"],
      ["1,1", "2,1"],
      eventTimestamp,
      liveDeploymentIds,
      livePositions,
      snapshot
    )

    const [, sql] = namedQuery.mock.calls[0]
    const identity = sql.text
      .replace(/\s+/g, " ")
      .match(
        /CASE WHEN target\."deployment_id" IS NOT NULL THEN NOT \(target\."deployment_id" = ANY\(\$(\d+)\)\)/
      )
    expect(sql.values[Number(identity![1]) - 1]).toEqual(liveDeploymentIds)
  })

  it("should judge a legacy row against the parcels the served scenes cover", async () => {
    await PlaceModel.disableByWorldIdAndDeployments(
      "example.dcl.eth",
      ["deployment-a"],
      ["1,1"],
      ["1,1", "2,1"],
      eventTimestamp,
      liveDeploymentIds,
      livePositions,
      snapshot
    )

    const [, sql] = namedQuery.mock.calls[0]
    const footprint = sql.text
      .replace(/\s+/g, " ")
      .match(/ELSE NOT \(target\."positions" && \$(\d+)::varchar\[\]\)/)
    expect(sql.values[Number(footprint![1]) - 1]).toEqual(livePositions)
  })

  it("should only reach rows the survivor snapshot could speak about", async () => {
    await PlaceModel.disableByWorldIdAndDeployments(
      "example.dcl.eth",
      ["deployment-a"],
      ["1,1"],
      ["1,1", "2,1"],
      eventTimestamp,
      liveDeploymentIds,
      livePositions,
      snapshot
    )

    const [, sql] = namedQuery.mock.calls[0]
    const normalized = sql.text.replace(/\s+/g, " ")
    // The identity term must be the first thing in the disjunction with nothing conjoined ahead of
    // it: guarding it would stop an undeployment being authoritative over a deployment it raced,
    // which no assertion on the fragment alone can detect.
    expect(normalized).toMatch(
      /END \) AND \( target\."deployment_id" = ANY\(\$\d+\) OR \( EXISTS \(/
    )
    const guard = normalized.match(
      /FROM unnest\( \$(\d+)::bpchar\[\], \$\d+::text\[\] \) AS snapshot/
    )
    expect(sql.values[Number(guard![1]) - 1]).toEqual([snapshot[0].id])
  })

  it("should report legacy fallback matches separately", async () => {
    namedQuery.mockResolvedValue([
      { deployment_id: "deployment-a" },
      { deployment_id: null },
    ])

    const result = await PlaceModel.disableByWorldIdAndDeployments(
      "example.dcl.eth",
      ["deployment-a"],
      ["1,1"],
      ["1,1", "2,1"],
      eventTimestamp,
      liveDeploymentIds,
      livePositions,
      snapshot
    )

    expect(result).toEqual({ deploymentIdMatches: 1, legacyBaseMatches: 1 })
  })
})

describe("when disabling the places of an undeployed world", () => {
  let eventTimestamp: number
  let liveDeploymentIds: string[]
  let livePositions: string[]
  let snapshot: Array<{ id: string; deployment_id: string | null }>

  beforeEach(() => {
    eventTimestamp = Date.parse("2026-08-03T12:00:00.000Z")
    liveDeploymentIds = ["deployment-live"]
    livePositions = ["9,9"]
    snapshot = [
      { id: "11111111-1111-1111-1111-111111111111", deployment_id: null },
    ]
    namedQuery.mockResolvedValue([])
  })

  it("should spare the scenes the content server still serves", async () => {
    await PlaceModel.disableByWorldId(
      "Example.DCL.ETH",
      eventTimestamp,
      liveDeploymentIds,
      livePositions
    )

    const [name, sql] = namedQuery.mock.calls[0]
    const normalizedSql = sql.text.trim().replace(/\s{2,}/gi, " ")
    expect({ name, normalizedSql }).toEqual({
      name: "disable_by_world_id",
      normalizedSql: expect.stringMatching(
        /CASE WHEN target\."deployment_id" IS NOT NULL THEN NOT \(target\."deployment_id" = ANY\(\$.*ELSE NOT \(target\."positions" && \$/
      ),
    })
  })

  it("should bind the served deployments to the identity branch, not the footprint branch", async () => {
    await PlaceModel.disableByWorldId(
      "example.dcl.eth",
      eventTimestamp,
      liveDeploymentIds,
      livePositions
    )

    const [, sql] = namedQuery.mock.calls[0]
    const identity = sql.text
      .replace(/\s+/g, " ")
      .match(
        /CASE WHEN target\."deployment_id" IS NOT NULL THEN NOT \(target\."deployment_id" = ANY\(\$(\d+)\)\)/
      )
    expect(sql.values[Number(identity![1]) - 1]).toEqual(liveDeploymentIds)
  })

  it("should normalize the world id", async () => {
    await PlaceModel.disableByWorldId(
      "Example.DCL.ETH",
      eventTimestamp,
      liveDeploymentIds,
      livePositions
    )

    const [, sql] = namedQuery.mock.calls[0]
    expect(sql.values).toContain("example.dcl.eth")
  })

  it("should return the rows it disabled so their removal can be recorded", async () => {
    namedQuery.mockResolvedValue([{ id: "place-a" }])

    expect(
      await PlaceModel.disableByWorldId(
        "example.dcl.eth",
        eventTimestamp,
        liveDeploymentIds,
        livePositions
      )
    ).toEqual([{ id: "place-a" }])
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
