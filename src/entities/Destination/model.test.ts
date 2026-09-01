import DestinationModel from "./model"
import { FindDestinationsWithAggregatesOptions } from "./types"
import PlaceModel from "../Place/model"
import { PlaceListOrderBy } from "../Place/types"
import WorldModel from "../World/model"

/**
 * The ORDER BY is assembled from SQL fragments, so what matters is the relative position of each
 * term inside the emitted text rather than the whole statement.
 */
function orderByOf(sql: string): string {
  const index = sql.lastIndexOf("ORDER BY")
  return index === -1 ? "" : sql.slice(index).replace(/\s{2,}/gi, " ")
}

/**
 * Position of a term inside the ORDER BY. Throws when the term is absent, so a precedence
 * assertion cannot pass on a term that is not there: a raw indexOf would return -1, and -1 is
 * lower than any real position.
 */
function positionOf(orderBy: string, term: string): number {
  const index = orderBy.indexOf(term)
  if (index === -1) {
    throw new Error(`"${term}" is missing from the ORDER BY: ${orderBy}`)
  }
  return index
}

/**
 * Fragments the content-quality filter contributes to the WHERE clause, one per entity branch.
 *
 * Each is qualified with the alias of the branch it guards, so its presence in the statement is
 * what tells the two branches apart. The worlds image term is spelled out down to `IS NOT NULL`
 * because `COALESCE(w.image, lp.image)` on its own also appears in the worlds SELECT list, where it
 * would match whether or not the filter is applied.
 */
const PLACES_CONTENT_FILTER = "p.highlighted IS TRUE"
const WORLDS_CONTENT_FILTER = "w.highlighted IS TRUE"
const WORLDS_CONTENT_FILTER_IMAGE = "COALESCE(w.image, lp.image) IS NOT NULL"

/** SQL text of the statement the model handed to its query runner. */
function sqlOf(namedQuery: jest.SpyInstance): string {
  return namedQuery.mock.calls[0][1].text
}

describe("findWithAggregates", () => {
  let placesNamedQuery: jest.SpyInstance
  let worldsNamedQuery: jest.SpyInstance
  let options: FindDestinationsWithAggregatesOptions

  beforeEach(() => {
    placesNamedQuery = jest
      .spyOn(PlaceModel, "namedQuery")
      .mockResolvedValue([])
    worldsNamedQuery = jest
      .spyOn(WorldModel, "namedQuery")
      .mockResolvedValue([])
    options = {
      positions: [],
      world_names: [],
      names: [],
      offset: 0,
      limit: 100,
      only_favorites: false,
      only_highlighted: false,
      only_worlds: false,
      only_places: false,
      order_by: PlaceListOrderBy.LIKE_SCORE_BEST,
      order: "desc",
      search: "",
      categories: [],
      placeUserCounts: [{ base_position: "0,0", count: 15 }],
      worldUserCounts: [{ world_name: "paralax.dcl.eth", count: 15 }],
    }
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe("when ordering by most active", () => {
    beforeEach(() => {
      options.order_by = PlaceListOrderBy.MOST_ACTIVE
    })

    describe("and neither only_places nor only_worlds is set", () => {
      let orderBy: string

      beforeEach(async () => {
        await DestinationModel.findWithAggregates(options)
        orderBy = orderByOf(placesNamedQuery.mock.calls[0][1].text)
      })

      it("should run the union query", () => {
        expect(placesNamedQuery.mock.calls[0][0]).toBe(
          "find_destinations_union"
        )
      })

      it("should rank the live user count above the highlighted flag", () => {
        expect(positionOf(orderBy, "sub.live_user_count DESC")).toBeLessThan(
          positionOf(orderBy, "sub.highlighted DESC")
        )
      })

      it("should rank the live user count above the curation ranking", () => {
        expect(positionOf(orderBy, "sub.live_user_count DESC")).toBeLessThan(
          positionOf(orderBy, "sub.ranking DESC")
        )
      })

      it("should keep the highlighted flag above the curation ranking as tie-breaker", () => {
        expect(positionOf(orderBy, "sub.highlighted DESC")).toBeLessThan(
          positionOf(orderBy, "sub.ranking DESC")
        )
      })
    })

    describe("and only_places is set", () => {
      let orderBy: string

      beforeEach(async () => {
        options.only_places = true
        await DestinationModel.findWithAggregates(options)
        orderBy = orderByOf(placesNamedQuery.mock.calls[0][1].text)
      })

      it("should run the places-only query", () => {
        expect(placesNamedQuery.mock.calls[0][0]).toBe(
          "find_destinations_places"
        )
      })

      it("should rank the live user count above the highlighted flag", () => {
        expect(positionOf(orderBy, "live_user_count DESC")).toBeLessThan(
          positionOf(orderBy, "p.highlighted DESC")
        )
      })

      it("should rank the live user count above the curation ranking", () => {
        expect(positionOf(orderBy, "live_user_count DESC")).toBeLessThan(
          positionOf(orderBy, "p.ranking DESC")
        )
      })
    })

    describe("and only_worlds is set", () => {
      let orderBy: string

      beforeEach(async () => {
        options.only_worlds = true
        await DestinationModel.findWithAggregates(options)
        orderBy = orderByOf(worldsNamedQuery.mock.calls[0][1].text)
      })

      it("should run the worlds-only query", () => {
        expect(worldsNamedQuery.mock.calls[0][0]).toBe(
          "find_destinations_worlds"
        )
      })

      it("should rank the live user count above the highlighted flag", () => {
        expect(positionOf(orderBy, "live_user_count DESC")).toBeLessThan(
          positionOf(orderBy, "w.highlighted DESC")
        )
      })

      it("should rank the live user count above the curation ranking", () => {
        expect(positionOf(orderBy, "live_user_count DESC")).toBeLessThan(
          positionOf(orderBy, "w.ranking DESC")
        )
      })
    })
  })

  describe("when ordering by like score", () => {
    let orderBy: string

    beforeEach(async () => {
      options.order_by = PlaceListOrderBy.LIKE_SCORE_BEST
      await DestinationModel.findWithAggregates(options)
      orderBy = orderByOf(placesNamedQuery.mock.calls[0][1].text)
    })

    it("should not order by the live user count", () => {
      expect(orderBy).not.toContain("live_user_count")
    })

    it("should keep curation at the top of the order", () => {
      expect(orderBy).toContain(
        "ORDER BY sub.highlighted DESC, sub.ranking DESC NULLS LAST"
      )
    })
  })

  describe("when no filter narrows the feed to named destinations", () => {
    describe("and neither only_places nor only_worlds is set", () => {
      let sql: string

      beforeEach(async () => {
        await DestinationModel.findWithAggregates(options)
        sql = sqlOf(placesNamedQuery)
      })

      it("should require content on the places branch", () => {
        expect(sql).toContain(PLACES_CONTENT_FILTER)
      })

      it("should require content on the worlds branch", () => {
        expect(sql).toContain(WORLDS_CONTENT_FILTER)
      })

      it("should read the worlds image from the world and its latest place", () => {
        expect(sql).toContain(WORLDS_CONTENT_FILTER_IMAGE)
      })

      it("should not read the worlds image from the world column alone", () => {
        expect(sql).not.toContain("w.image IS NOT NULL")
      })
    })

    describe("and only_places is set", () => {
      let sql: string

      beforeEach(async () => {
        options.only_places = true
        await DestinationModel.findWithAggregates(options)
        sql = sqlOf(placesNamedQuery)
      })

      it("should require content on the places branch", () => {
        expect(sql).toContain(PLACES_CONTENT_FILTER)
      })
    })

    describe("and only_worlds is set", () => {
      let sql: string

      beforeEach(async () => {
        options.only_worlds = true
        await DestinationModel.findWithAggregates(options)
        sql = sqlOf(worldsNamedQuery)
      })

      it("should require content on the worlds branch", () => {
        expect(sql).toContain(WORLDS_CONTENT_FILTER)
      })

      it("should read the worlds image from the world and its latest place", () => {
        expect(sql).toContain(WORLDS_CONTENT_FILTER_IMAGE)
      })
    })
  })

  describe("when filtering by pointer", () => {
    let sql: string

    beforeEach(async () => {
      options.positions = ["0,0"]
      await DestinationModel.findWithAggregates(options)
      sql = sqlOf(placesNamedQuery)
    })

    it("should not require content on the places branch", () => {
      expect(sql).not.toContain(PLACES_CONTENT_FILTER)
    })

    it("should still require content on the worlds branch", () => {
      expect(sql).toContain(WORLDS_CONTENT_FILTER)
    })
  })

  describe("when filtering by world names", () => {
    let sql: string

    beforeEach(async () => {
      options.world_names = ["paralax.dcl.eth"]
      await DestinationModel.findWithAggregates(options)
      sql = sqlOf(placesNamedQuery)
    })

    it("should not require content on the worlds branch", () => {
      expect(sql).not.toContain(WORLDS_CONTENT_FILTER)
    })

    it("should still require content on the places branch", () => {
      expect(sql).toContain(PLACES_CONTENT_FILTER)
    })
  })

  describe("when filtering by names", () => {
    let sql: string

    beforeEach(async () => {
      options.names = ["paralax"]
      await DestinationModel.findWithAggregates(options)
      sql = sqlOf(placesNamedQuery)
    })

    it("should not require content on the worlds branch", () => {
      expect(sql).not.toContain(WORLDS_CONTENT_FILTER)
    })

    it("should still require content on the places branch", () => {
      expect(sql).toContain(PLACES_CONTENT_FILTER)
    })
  })

  describe("when looking up destinations the caller already named", () => {
    describe("and searching", () => {
      let sql: string

      beforeEach(async () => {
        options.search = "plaza"
        await DestinationModel.findWithAggregates(options)
        sql = sqlOf(placesNamedQuery)
      })

      it("should not require content on the places branch", () => {
        expect(sql).not.toContain(PLACES_CONTENT_FILTER)
      })

      it("should not require content on the worlds branch", () => {
        expect(sql).not.toContain(WORLDS_CONTENT_FILTER)
      })
    })

    describe("and filtering by ids", () => {
      let sql: string

      beforeEach(async () => {
        options.ids = ["7bd4a0f2-1a1a-4d9f-9f7e-2f3b9a0c1d2e"]
        await DestinationModel.findWithAggregates(options)
        sql = sqlOf(placesNamedQuery)
      })

      it("should not require content on the places branch", () => {
        expect(sql).not.toContain(PLACES_CONTENT_FILTER)
      })

      it("should not require content on the worlds branch", () => {
        expect(sql).not.toContain(WORLDS_CONTENT_FILTER)
      })
    })

    describe("and filtering by owner", () => {
      let sql: string

      beforeEach(async () => {
        options.owner = "0x0000000000000000000000000000000000000001"
        await DestinationModel.findWithAggregates(options)
        sql = sqlOf(placesNamedQuery)
      })

      it("should not require content on the places branch", () => {
        expect(sql).not.toContain(PLACES_CONTENT_FILTER)
      })

      it("should not require content on the worlds branch", () => {
        expect(sql).not.toContain(WORLDS_CONTENT_FILTER)
      })
    })

    describe("and filtering by creator address", () => {
      let sql: string

      beforeEach(async () => {
        options.creator_address = "0x0000000000000000000000000000000000000002"
        await DestinationModel.findWithAggregates(options)
        sql = sqlOf(placesNamedQuery)
      })

      it("should not require content on the places branch", () => {
        expect(sql).not.toContain(PLACES_CONTENT_FILTER)
      })

      it("should not require content on the worlds branch", () => {
        expect(sql).not.toContain(WORLDS_CONTENT_FILTER)
      })
    })

    describe("and filtering only favorites", () => {
      let sql: string

      beforeEach(async () => {
        options.only_favorites = true
        await DestinationModel.findWithAggregates(options)
        sql = sqlOf(placesNamedQuery)
      })

      it("should not require content on the places branch", () => {
        expect(sql).not.toContain(PLACES_CONTENT_FILTER)
      })

      it("should not require content on the worlds branch", () => {
        expect(sql).not.toContain(WORLDS_CONTENT_FILTER)
      })
    })

    describe("and filtering only highlighted", () => {
      let sql: string

      beforeEach(async () => {
        options.only_highlighted = true
        await DestinationModel.findWithAggregates(options)
        sql = sqlOf(placesNamedQuery)
      })

      it("should not require content on the places branch", () => {
        expect(sql).not.toContain(PLACES_CONTENT_FILTER)
      })

      it("should not require content on the worlds branch", () => {
        expect(sql).not.toContain(WORLDS_CONTENT_FILTER)
      })
    })
  })

  describe("when filtering by categories", () => {
    let sql: string

    beforeEach(async () => {
      options.categories = ["art"]
      await DestinationModel.findWithAggregates(options)
      sql = sqlOf(placesNamedQuery)
    })

    it("should still require content on the places branch", () => {
      expect(sql).toContain(PLACES_CONTENT_FILTER)
    })

    it("should still require content on the worlds branch", () => {
      expect(sql).toContain(WORLDS_CONTENT_FILTER)
    })
  })

  describe("when filtering by sdk", () => {
    let sql: string

    beforeEach(async () => {
      options.sdk = "7"
      await DestinationModel.findWithAggregates(options)
      sql = sqlOf(placesNamedQuery)
    })

    it("should still require content on the places branch", () => {
      expect(sql).toContain(PLACES_CONTENT_FILTER)
    })

    it("should still require content on the worlds branch", () => {
      expect(sql).toContain(WORLDS_CONTENT_FILTER)
    })
  })
})

describe("count", () => {
  let placesNamedQuery: jest.SpyInstance
  let worldsNamedQuery: jest.SpyInstance
  let options: Parameters<typeof DestinationModel.count>[0]

  beforeEach(() => {
    placesNamedQuery = jest
      .spyOn(PlaceModel, "namedQuery")
      .mockResolvedValue([{ total: "0" }])
    worldsNamedQuery = jest
      .spyOn(WorldModel, "namedQuery")
      .mockResolvedValue([{ total: "0" }])
    options = {
      positions: [],
      world_names: [],
      names: [],
      only_favorites: false,
      only_highlighted: false,
      only_worlds: false,
      only_places: false,
      search: "",
      categories: [],
    }
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe("when no filter narrows the feed to named destinations", () => {
    describe("and neither only_places nor only_worlds is set", () => {
      let sql: string

      beforeEach(async () => {
        await DestinationModel.count(options)
        sql = sqlOf(placesNamedQuery)
      })

      it("should require content on the places branch", () => {
        expect(sql).toContain(PLACES_CONTENT_FILTER)
      })

      it("should require content on the worlds branch", () => {
        expect(sql).toContain(WORLDS_CONTENT_FILTER)
      })

      it("should read the worlds image from the world and its latest place", () => {
        expect(sql).toContain(WORLDS_CONTENT_FILTER_IMAGE)
      })

      it("should not read the worlds image from the world column alone", () => {
        expect(sql).not.toContain("w.image IS NOT NULL")
      })
    })

    describe("and only_places is set", () => {
      let sql: string

      beforeEach(async () => {
        options.only_places = true
        await DestinationModel.count(options)
        sql = sqlOf(placesNamedQuery)
      })

      it("should require content on the places branch", () => {
        expect(sql).toContain(PLACES_CONTENT_FILTER)
      })
    })

    describe("and only_worlds is set", () => {
      let sql: string

      beforeEach(async () => {
        options.only_worlds = true
        await DestinationModel.count(options)
        sql = sqlOf(worldsNamedQuery)
      })

      it("should require content on the worlds branch", () => {
        expect(sql).toContain(WORLDS_CONTENT_FILTER)
      })

      it("should read the worlds image from the world and its latest place", () => {
        expect(sql).toContain(WORLDS_CONTENT_FILTER_IMAGE)
      })
    })
  })

  describe("when filtering by pointer", () => {
    let sql: string

    beforeEach(async () => {
      options.positions = ["0,0"]
      await DestinationModel.count(options)
      sql = sqlOf(placesNamedQuery)
    })

    it("should not require content on the places branch", () => {
      expect(sql).not.toContain(PLACES_CONTENT_FILTER)
    })

    it("should still require content on the worlds branch", () => {
      expect(sql).toContain(WORLDS_CONTENT_FILTER)
    })
  })

  describe("when filtering by world names", () => {
    let sql: string

    beforeEach(async () => {
      options.world_names = ["paralax.dcl.eth"]
      await DestinationModel.count(options)
      sql = sqlOf(placesNamedQuery)
    })

    it("should not require content on the worlds branch", () => {
      expect(sql).not.toContain(WORLDS_CONTENT_FILTER)
    })

    it("should still require content on the places branch", () => {
      expect(sql).toContain(PLACES_CONTENT_FILTER)
    })
  })

  describe("when filtering by names", () => {
    let sql: string

    beforeEach(async () => {
      options.names = ["paralax"]
      await DestinationModel.count(options)
      sql = sqlOf(placesNamedQuery)
    })

    it("should not require content on the worlds branch", () => {
      expect(sql).not.toContain(WORLDS_CONTENT_FILTER)
    })

    it("should still require content on the places branch", () => {
      expect(sql).toContain(PLACES_CONTENT_FILTER)
    })
  })

  describe("when looking up destinations the caller already named", () => {
    describe("and searching", () => {
      let sql: string

      beforeEach(async () => {
        options.search = "plaza"
        await DestinationModel.count(options)
        sql = sqlOf(placesNamedQuery)
      })

      it("should not require content on the places branch", () => {
        expect(sql).not.toContain(PLACES_CONTENT_FILTER)
      })

      it("should not require content on the worlds branch", () => {
        expect(sql).not.toContain(WORLDS_CONTENT_FILTER)
      })
    })

    describe("and filtering by ids", () => {
      let sql: string

      beforeEach(async () => {
        options.ids = ["7bd4a0f2-1a1a-4d9f-9f7e-2f3b9a0c1d2e"]
        await DestinationModel.count(options)
        sql = sqlOf(placesNamedQuery)
      })

      it("should not require content on the places branch", () => {
        expect(sql).not.toContain(PLACES_CONTENT_FILTER)
      })

      it("should not require content on the worlds branch", () => {
        expect(sql).not.toContain(WORLDS_CONTENT_FILTER)
      })
    })

    describe("and filtering by owner", () => {
      let sql: string

      beforeEach(async () => {
        options.owner = "0x0000000000000000000000000000000000000001"
        await DestinationModel.count(options)
        sql = sqlOf(placesNamedQuery)
      })

      it("should not require content on the places branch", () => {
        expect(sql).not.toContain(PLACES_CONTENT_FILTER)
      })

      it("should not require content on the worlds branch", () => {
        expect(sql).not.toContain(WORLDS_CONTENT_FILTER)
      })
    })

    describe("and filtering by creator address", () => {
      let sql: string

      beforeEach(async () => {
        options.creator_address = "0x0000000000000000000000000000000000000002"
        await DestinationModel.count(options)
        sql = sqlOf(placesNamedQuery)
      })

      it("should not require content on the places branch", () => {
        expect(sql).not.toContain(PLACES_CONTENT_FILTER)
      })

      it("should not require content on the worlds branch", () => {
        expect(sql).not.toContain(WORLDS_CONTENT_FILTER)
      })
    })

    describe("and filtering only favorites", () => {
      let sql: string

      beforeEach(async () => {
        options.only_favorites = true
        await DestinationModel.count(options)
        sql = sqlOf(placesNamedQuery)
      })

      it("should not require content on the places branch", () => {
        expect(sql).not.toContain(PLACES_CONTENT_FILTER)
      })

      it("should not require content on the worlds branch", () => {
        expect(sql).not.toContain(WORLDS_CONTENT_FILTER)
      })
    })

    describe("and filtering only highlighted", () => {
      let sql: string

      beforeEach(async () => {
        options.only_highlighted = true
        await DestinationModel.count(options)
        sql = sqlOf(placesNamedQuery)
      })

      it("should not require content on the places branch", () => {
        expect(sql).not.toContain(PLACES_CONTENT_FILTER)
      })

      it("should not require content on the worlds branch", () => {
        expect(sql).not.toContain(WORLDS_CONTENT_FILTER)
      })
    })
  })

  describe("when filtering by categories", () => {
    let sql: string

    beforeEach(async () => {
      options.categories = ["art"]
      await DestinationModel.count(options)
      sql = sqlOf(placesNamedQuery)
    })

    it("should still require content on the places branch", () => {
      expect(sql).toContain(PLACES_CONTENT_FILTER)
    })

    it("should still require content on the worlds branch", () => {
      expect(sql).toContain(WORLDS_CONTENT_FILTER)
    })
  })

  describe("when filtering by sdk", () => {
    let sql: string

    beforeEach(async () => {
      options.sdk = "7"
      await DestinationModel.count(options)
      sql = sqlOf(placesNamedQuery)
    })

    it("should still require content on the places branch", () => {
      expect(sql).toContain(PLACES_CONTENT_FILTER)
    })

    it("should still require content on the worlds branch", () => {
      expect(sql).toContain(WORLDS_CONTENT_FILTER)
    })
  })
})
