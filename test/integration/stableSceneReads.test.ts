import { fetchWorldScenes } from "../../bin/rebuildWorldPlaces"
import { fetchServedScenes } from "../../bin/repairUndeployedWorldPlaces"

const BASE = "https://worlds-content-server.decentraland.org"

type Row = { entityId: string; base: string; timestamp: number }

function page(rows: Row[], total: number) {
  return {
    ok: true,
    json: async () => ({
      total,
      scenes: rows.map((row) => ({
        entityId: row.entityId,
        parcels: [row.base],
        entity: {
          timestamp: row.timestamp,
          metadata: { scene: { base: row.base } },
        },
      })),
    }),
  } as Response
}

function rows(from: number, count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    entityId: `entity-${from + index}`,
    base: `${from + index},0`,
    timestamp: 1_700_000_000_000 + from + index,
  }))
}

/**
 * The listing is ordered without a tiebreaker and paged by offset, so a removal before the next offset
 * together with an addition after the end keeps the total unchanged, repeats nothing, and still hides
 * a live scene. Both of these readers drive destructive work -- one disables orphan places, the other
 * re-enables places and rewrites watermarks -- so neither may act on a reading like that.
 */
describe("when a paginated scene listing shifts underneath a read", () => {
  let fetchMock: jest.SpyInstance

  beforeEach(() => {
    fetchMock = jest.spyOn(global, "fetch")
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("and the world fits in a single page", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(page(rows(0, 30), 30))
    })

    it("should read it once, since one page is already one query upstream", async () => {
      await fetchServedScenes(BASE, "single.dcl.eth")

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  describe("and a multi-page read repeats identically", () => {
    let scenes: Awaited<ReturnType<typeof fetchServedScenes>>

    beforeEach(async () => {
      // two whole reads, both consistent
      for (let attempt = 0; attempt < 2; attempt++) {
        fetchMock.mockResolvedValueOnce(page(rows(0, 100), 130))
        fetchMock.mockResolvedValueOnce(page(rows(100, 30), 130))
      }

      scenes = await fetchServedScenes(BASE, "stable.dcl.eth")
    })

    it("should accept it", () => {
      expect(scenes).toHaveLength(130)
    })

    it("should have read the whole listing twice to prove it", () => {
      expect(fetchMock).toHaveBeenCalledTimes(4)
    })
  })

  describe("and the same total hides a shift across a page boundary", () => {
    beforeEach(() => {
      // Every read is internally consistent: total 130, 130 rows, no repeats. But the set differs
      // between reads, which is exactly what a removal plus an addition looks like.
      for (let attempt = 0; attempt < 3; attempt++) {
        fetchMock.mockResolvedValueOnce(page(rows(0, 100), 130))
        fetchMock.mockResolvedValueOnce(
          page(rows(100 + attempt * 1000, 30), 130)
        )
      }
    })

    it("should refuse rather than return a mixed listing", async () => {
      await expect(fetchServedScenes(BASE, "shifting.dcl.eth")).rejects.toThrow(
        "Could not read a stable scene listing for shifting.dcl.eth"
      )
    })
  })

  describe("and the ids match across reads but their content does not", () => {
    beforeEach(() => {
      // A set comparison on ids alone would call these two reads identical. Comparing the base,
      // footprint and timestamp is what notices the second page describing different content.
      for (let attempt = 0; attempt < 3; attempt++) {
        fetchMock.mockResolvedValueOnce(page(rows(0, 100), 130))
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            total: 130,
            scenes: rows(100, 30).map((row, index) => ({
              entityId: row.entityId,
              // same ids, different footprint on each attempt
              parcels: [`${row.base}`, `${900 + attempt},${index}`],
              entity: {
                timestamp: row.timestamp + attempt,
                metadata: { scene: { base: row.base } },
              },
            })),
          }),
        } as Response)
      }
    })

    it("should refuse, since the reads describe different content", async () => {
      await expect(fetchServedScenes(BASE, "shifting.dcl.eth")).rejects.toThrow(
        "Could not read a stable scene listing"
      )
    })
  })

  describe("and the rebuild reader sees the same shift", () => {
    beforeEach(() => {
      for (let attempt = 0; attempt < 3; attempt++) {
        fetchMock.mockResolvedValueOnce(page(rows(0, 100), 130))
        fetchMock.mockResolvedValueOnce(
          page(rows(100 + attempt * 1000, 30), 130)
        )
      }
    })

    it("should refuse, since its orphan sweep would disable the hidden scene's place", async () => {
      await expect(fetchWorldScenes(BASE, "shifting.dcl.eth")).rejects.toThrow(
        "Could not read a stable scene listing"
      )
    })
  })

  describe("and only the base differs across reads of the rebuild listing", () => {
    beforeEach(() => {
      for (let attempt = 0; attempt < 3; attempt++) {
        fetchMock.mockResolvedValueOnce(page(rows(0, 100), 130))
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            total: 130,
            scenes: rows(100, 30).map((row) => ({
              entityId: row.entityId,
              parcels: [row.base],
              entity: {
                timestamp: row.timestamp,
                // the base is what resolves and updates places downstream
                metadata: { scene: { base: `${800 + attempt},0` } },
              },
            })),
          }),
        } as Response)
      }
    })

    it("should refuse, since the base decides which place each scene updates", async () => {
      await expect(
        fetchWorldScenes(BASE, "shifting-base.dcl.eth")
      ).rejects.toThrow("Could not read a stable scene listing")
    })
  })

  describe("and the rebuild reader gets two identical multi-page reads", () => {
    let scenes: Awaited<ReturnType<typeof fetchWorldScenes>>

    beforeEach(async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        fetchMock.mockResolvedValueOnce(page(rows(0, 100), 130))
        fetchMock.mockResolvedValueOnce(page(rows(100, 30), 130))
      }

      scenes = await fetchWorldScenes(BASE, "stable.dcl.eth")
    })

    it("should accept it", () => {
      expect(scenes).toHaveLength(130)
    })
  })
})
