import DestinationModel from "./model"
import { FindDestinationsWithAggregatesOptions } from "./types"
import PlaceModel from "../Place/model"
import { PlaceListOrderBy } from "../Place/types"
import WorldModel from "../World/model"

const placesNamedQuery = jest.spyOn(PlaceModel, "namedQuery")
const worldsNamedQuery = jest.spyOn(WorldModel, "namedQuery")

const baseOptions: FindDestinationsWithAggregatesOptions = {
  positions: [],
  world_names: [],
  names: [],
  offset: 0,
  limit: 100,
  only_favorites: false,
  only_highlighted: false,
  only_worlds: false,
  only_places: false,
  order_by: PlaceListOrderBy.MOST_ACTIVE,
  order: "desc",
  search: "",
  categories: [],
  placeUserCounts: [{ base_position: "0,0", count: 15 }],
  worldUserCounts: [{ world_name: "paralax.dcl.eth", count: 15 }],
}

/**
 * The ORDER BY is built from SQL fragments, so the assertion that matters is the relative
 * position of each term inside the emitted text rather than the whole statement.
 */
function orderByOf(sql: string): string {
  const index = sql.lastIndexOf("ORDER BY")
  return index === -1 ? "" : sql.slice(index).replace(/\s{2,}/gi, " ")
}

beforeEach(() => {
  placesNamedQuery.mockReset()
  worldsNamedQuery.mockReset()
  placesNamedQuery.mockResolvedValue([])
  worldsNamedQuery.mockResolvedValue([])
})

afterEach(() => {
  jest.resetAllMocks()
})

describe(`findWithAggregates`, () => {
  describe(`when ordering by MOST_ACTIVE`, () => {
    test(`should rank live users above curation in the union query`, async () => {
      await DestinationModel.findWithAggregates(baseOptions)

      const [name, sql] = placesNamedQuery.mock.calls[0]
      expect(name).toBe("find_destinations_union")
      const orderBy = orderByOf(sql.text)
      expect(orderBy).toContain("sub.live_user_count DESC")
      expect(orderBy.indexOf("sub.live_user_count DESC")).toBeLessThan(
        orderBy.indexOf("sub.highlighted DESC")
      )
      expect(orderBy.indexOf("sub.live_user_count DESC")).toBeLessThan(
        orderBy.indexOf("sub.ranking DESC")
      )
    })

    test(`should rank live users above curation in the places-only query`, async () => {
      await DestinationModel.findWithAggregates({
        ...baseOptions,
        only_places: true,
      })

      const [name, sql] = placesNamedQuery.mock.calls[0]
      expect(name).toBe("find_destinations_places")
      const orderBy = orderByOf(sql.text)
      expect(orderBy.indexOf("live_user_count DESC")).toBeLessThan(
        orderBy.indexOf("p.highlighted DESC")
      )
    })

    test(`should rank live users above curation in the worlds-only query`, async () => {
      await DestinationModel.findWithAggregates({
        ...baseOptions,
        only_worlds: true,
      })

      const [name, sql] = worldsNamedQuery.mock.calls[0]
      expect(name).toBe("find_destinations_worlds")
      const orderBy = orderByOf(sql.text)
      expect(orderBy.indexOf("live_user_count DESC")).toBeLessThan(
        orderBy.indexOf("w.highlighted DESC")
      )
    })

    test(`should keep curation as the tie-breaker between equally busy destinations`, async () => {
      await DestinationModel.findWithAggregates(baseOptions)

      const orderBy = orderByOf(placesNamedQuery.mock.calls[0][1].text)
      expect(orderBy.indexOf("sub.highlighted DESC")).toBeLessThan(
        orderBy.indexOf("sub.ranking DESC")
      )
    })
  })

  describe(`when ordering by anything else`, () => {
    test(`should leave the curated order untouched`, async () => {
      await DestinationModel.findWithAggregates({
        ...baseOptions,
        order_by: PlaceListOrderBy.LIKE_SCORE_BEST,
      })

      const orderBy = orderByOf(placesNamedQuery.mock.calls[0][1].text)
      expect(orderBy).not.toContain("live_user_count")
      expect(orderBy).toContain(
        "ORDER BY sub.highlighted DESC, sub.ranking DESC NULLS LAST"
      )
    })
  })
})
