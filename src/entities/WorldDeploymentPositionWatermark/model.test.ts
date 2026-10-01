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
    let sqlText: string
    let sqlValues: unknown[]

    beforeEach(async () => {
      await WorldDeploymentPositionWatermarkModel.recordPositions(
        "Example.DCL.ETH",
        ["0,0", "1,0", "1,0"],
        deployedAt
      )
      const [, sql] = namedQuery.mock.calls[0]
      sqlText = sql.text.replace(/\s+/g, " ")
      sqlValues = sql.values
    })

    it("should keep the newest entity timestamp per position", () => {
      expect(sqlText).toContain(
        `SET "superseded_at" = GREATEST("world_deployment_position_watermarks"."superseded_at", EXCLUDED."superseded_at")`
      )
    })

    it("should leave the removal clock untouched", () => {
      expect(sqlText).not.toContain(`"removed_at"`)
    })

    it("should pass all positions in one array parameter", () => {
      expect(sqlValues).toContainEqual(["0,0", "1,0", "1,0"])
    })

    it("should deduplicate positions in PostgreSQL", () => {
      expect(sqlText).toContain(`SELECT DISTINCT unnest(`)
    })

    it("should normalize the world id", () => {
      expect(sqlValues).toContain("example.dcl.eth")
    })
  })
})

describe("when recording the positions a removal cleared", () => {
  let removedAt: Date
  let sqlText: string
  let sqlValues: unknown[]

  beforeEach(async () => {
    removedAt = new Date("2026-08-03T12:00:00.000Z")
    await WorldDeploymentPositionWatermarkModel.recordRemovals(
      "example.dcl.eth",
      ["0,0"],
      removedAt
    )
    const [, sql] = namedQuery.mock.calls[0]
    sqlText = sql.text.replace(/\s+/g, " ")
    sqlValues = sql.values
  })

  it("should keep the newest emission time per position", () => {
    expect(sqlText).toContain(
      `SET "removed_at" = GREATEST("world_deployment_position_watermarks"."removed_at", EXCLUDED."removed_at")`
    )
  })

  it("should leave the entity-timestamp watermark untouched", () => {
    expect(sqlText).not.toContain(`"superseded_at"`)
  })

  it("should stamp the removal's emission time", () => {
    expect(sqlValues).toContainEqual(removedAt)
  })
})

describe("when looking for a deployment that supersedes incoming positions", () => {
  let deployedAt: Date
  let emittedAt: Date
  let result: boolean

  beforeEach(() => {
    deployedAt = new Date("2026-08-03T12:00:00.000Z")
    emittedAt = new Date("2026-08-03T12:01:30.000Z")
  })

  describe("and the incoming deployment has no positions", () => {
    beforeEach(async () => {
      result =
        await WorldDeploymentPositionWatermarkModel.hasSupersedingDeployment(
          "example.dcl.eth",
          [],
          deployedAt,
          emittedAt
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
    let sqlText: string
    let sqlValues: unknown[]

    beforeEach(async () => {
      namedQuery.mockResolvedValueOnce([{ exists: true }])

      result =
        await WorldDeploymentPositionWatermarkModel.hasSupersedingDeployment(
          "Example.DCL.ETH",
          ["0,0", "1,0"],
          deployedAt,
          emittedAt
        )
      const [, sql] = namedQuery.mock.calls[0]
      sqlText = sql.text.replace(/\s+/g, " ")
      sqlValues = sql.values
    })

    it("should return true", () => {
      expect(result).toBe(true)
    })

    it("should compare every incoming position", () => {
      expect(sqlValues).toContainEqual(["0,0", "1,0"])
    })

    it("should only match strictly newer deployment timestamps", () => {
      expect(sqlText).toContain(`watermark."superseded_at" > $`)
    })

    it("should match removals emitted at or after the deployment", () => {
      expect(sqlText).toContain(`watermark."removed_at" >= $`)
    })

    it("should compare entity timestamps and emission times as separate values", () => {
      expect(sqlValues).toEqual(expect.arrayContaining([deployedAt, emittedAt]))
    })
  })
})
