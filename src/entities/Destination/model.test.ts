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
        expect(orderBy.indexOf("sub.live_user_count DESC")).toBeLessThan(
          orderBy.indexOf("sub.highlighted DESC")
        )
      })

      it("should rank the live user count above the curation ranking", () => {
        expect(orderBy.indexOf("sub.live_user_count DESC")).toBeLessThan(
          orderBy.indexOf("sub.ranking DESC")
        )
      })

      it("should keep the highlighted flag above the curation ranking as tie-breaker", () => {
        expect(orderBy.indexOf("sub.highlighted DESC")).toBeLessThan(
          orderBy.indexOf("sub.ranking DESC")
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
        expect(orderBy.indexOf("live_user_count DESC")).toBeLessThan(
          orderBy.indexOf("p.highlighted DESC")
        )
      })

      it("should rank the live user count above the curation ranking", () => {
        expect(orderBy.indexOf("live_user_count DESC")).toBeLessThan(
          orderBy.indexOf("p.ranking DESC")
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
        expect(orderBy.indexOf("live_user_count DESC")).toBeLessThan(
          orderBy.indexOf("w.highlighted DESC")
        )
      })

      it("should rank the live user count above the curation ranking", () => {
        expect(orderBy.indexOf("live_user_count DESC")).toBeLessThan(
          orderBy.indexOf("w.ranking DESC")
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
})
