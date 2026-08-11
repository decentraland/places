import WorldDeploymentPositionWatermarkModel from "./model"

let namedQuery: jest.SpyInstance

beforeEach(() => {
  namedQuery = jest.spyOn(WorldDeploymentPositionWatermarkModel, "namedQuery")
  namedQuery.mockResolvedValue([])
})

afterEach(() => {
  namedQuery.mockRestore()
})

describe("when recording world deployment position watermarks", () => {
  let deployedAt: Date

  beforeEach(() => {
    deployedAt = new Date("2026-08-03T12:00:00.000Z")
  })

  describe("and the deployment has no positions", () => {
    beforeEach(async () => {
      await WorldDeploymentPositionWatermarkModel.recordPositions(
        "example.dcl.eth",
        [],
        deployedAt
      )
    })

    it("should not run a query", () => {
      expect(namedQuery).not.toHaveBeenCalled()
    })
  })

  describe("and the deployment covers positions", () => {
    beforeEach(async () => {
      await WorldDeploymentPositionWatermarkModel.recordPositions(
        "Example.DCL.ETH",
        ["0,0", "1,0", "1,0"],
        deployedAt
      )
    })

    it("should keep the newest deployment timestamp per position", () => {
      const [, sql] = namedQuery.mock.calls[0]

      expect(sql.text.replace(/\s+/g, " ")).toContain(
        `ON CONFLICT ("world_id", "position") DO UPDATE SET "superseded_at" = GREATEST(`
      )
    })

    it("should pass all positions in one array parameter", () => {
      const [, sql] = namedQuery.mock.calls[0]

      expect(sql.values).toContainEqual(["0,0", "1,0", "1,0"])
    })

    it("should deduplicate positions in PostgreSQL", () => {
      const [, sql] = namedQuery.mock.calls[0]

      expect(sql.text.replace(/\s+/g, " ")).toContain(
        `SELECT DISTINCT unnest($3::text[]) AS "position"`
      )
    })

    it("should normalize the world id", () => {
      const [, sql] = namedQuery.mock.calls[0]

      expect(sql.values).toContain("example.dcl.eth")
    })
  })
})

describe("when looking for a deployment that supersedes incoming positions", () => {
  let result: boolean

  describe("and the incoming deployment has no positions", () => {
    beforeEach(async () => {
      result =
        await WorldDeploymentPositionWatermarkModel.hasSupersedingDeployment(
          "example.dcl.eth",
          [],
          new Date("2026-08-03T12:00:00.000Z")
        )
    })

    it("should return false", () => {
      expect(result).toBe(false)
    })

    it("should not run a query", () => {
      expect(namedQuery).not.toHaveBeenCalled()
    })
  })

  describe("and a newer deployment covered an incoming position", () => {
    beforeEach(async () => {
      namedQuery.mockResolvedValueOnce([{ exists: true }])

      result =
        await WorldDeploymentPositionWatermarkModel.hasSupersedingDeployment(
          "Example.DCL.ETH",
          ["0,0", "1,0"],
          new Date("2026-08-03T12:00:00.000Z")
        )
    })

    it("should return true", () => {
      expect(result).toBe(true)
    })

    it("should compare every incoming position", () => {
      const [, sql] = namedQuery.mock.calls[0]

      expect(sql.values).toContainEqual(["0,0", "1,0"])
    })

    it("should only match strictly newer deployment timestamps", () => {
      const [, sql] = namedQuery.mock.calls[0]

      expect(sql.text.replace(/\s+/g, " ")).toContain(
        `watermark."superseded_at" > $`
      )
    })
  })
})
