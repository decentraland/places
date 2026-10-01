import WorldSceneUndeploymentModel from "./model"

const namedQuery = jest.spyOn(WorldSceneUndeploymentModel, "namedQuery")

beforeEach(() => {
  namedQuery.mockReset()
  namedQuery.mockResolvedValue([])
})

describe("when recording scenes a removal event named", () => {
  let removedAt: Date

  beforeEach(() => {
    removedAt = new Date(Date.parse("2026-08-03T12:00:00.000Z"))
  })

  describe("and the event carries no scenes", () => {
    beforeEach(async () => {
      await WorldSceneUndeploymentModel.recordRemovals(
        "example.dcl.eth",
        [],
        removedAt
      )
    })

    it("should not run a query", () => {
      expect(namedQuery).not.toHaveBeenCalled()
    })
  })

  describe("and the event carries scenes", () => {
    let sqlText: string
    let sqlValues: unknown[]

    beforeEach(async () => {
      await WorldSceneUndeploymentModel.recordRemovals(
        "Example.DCL.ETH",
        [
          {
            entityId: "deployment-a",
            baseParcel: "1,1",
            basePositionRejects: true,
          },
          {
            entityId: "deployment-b",
            baseParcel: "2,2",
            basePositionRejects: false,
          },
        ],
        removedAt
      )
      const [, sql] = namedQuery.mock.calls[0]
      sqlText = sql.text.replace(/\s+/g, " ")
      sqlValues = sql.values
    })

    it("should keep the newest emission time per deployment", () => {
      expect(sqlText).toContain(
        `"removed_at" = GREATEST("world_scene_undeployments"."removed_at", EXCLUDED."removed_at")`
      )
    })

    it("should leave the replacement clock untouched", () => {
      expect(sqlText).not.toContain(`"undeployed_at"`)
    })

    it("should record every undeployed scene with its base", () => {
      expect(sqlValues).toEqual(
        expect.arrayContaining([
          ["deployment-a", "deployment-b"],
          ["1,1", "2,2"],
        ])
      )
    })

    it("should record which bases may reject", () => {
      expect(sqlValues).toContainEqual([true, false])
    })

    it("should never disarm a base that already rejects", () => {
      expect(sqlText).toContain(
        `"base_position_rejects" = "world_scene_undeployments"."base_position_rejects" OR EXCLUDED."base_position_rejects"`
      )
    })

    it("should stamp the removal's emission time", () => {
      expect(sqlValues).toContainEqual(removedAt)
    })

    it("should normalize the world id", () => {
      expect(sqlValues).toContain("example.dcl.eth")
    })
  })

  describe("and the event repeats a deployment", () => {
    let arrayLengths: number[]

    beforeEach(async () => {
      await WorldSceneUndeploymentModel.recordRemovals(
        "example.dcl.eth",
        [
          {
            entityId: "deployment-a",
            baseParcel: "1,1",
            basePositionRejects: true,
          },
          {
            entityId: "deployment-a",
            baseParcel: "1,1",
            basePositionRejects: true,
          },
        ],
        removedAt
      )
      const [, sql] = namedQuery.mock.calls[0]
      arrayLengths = sql.values
        .filter((value: unknown): value is unknown[] => Array.isArray(value))
        .map((array: unknown[]) => array.length)
    })

    it("should dedupe every array in lockstep, so unnest cannot pad with NULL", () => {
      expect(arrayLengths).toEqual([1, 1, 1])
    })
  })

  describe("and the event carries thousands of scenes", () => {
    let bindValues: unknown[]

    beforeEach(async () => {
      await WorldSceneUndeploymentModel.recordRemovals(
        "example.dcl.eth",
        Array.from({ length: 5_000 }, (_, index) => ({
          entityId: `deployment-${index}`,
          baseParcel: `${index},0`,
          basePositionRejects: true,
        })),
        removedAt
      )
      const [, sql] = namedQuery.mock.calls[0]
      bindValues = sql.values
    })

    it("should keep the bind parameter count constant", () => {
      expect(bindValues).toHaveLength(5)
    })
  })
})

describe("when recording scenes a deployment replaced", () => {
  let replacedAt: Date
  let sqlText: string
  let sqlValues: unknown[]

  beforeEach(async () => {
    replacedAt = new Date(Date.parse("2026-08-03T12:00:00.000Z"))
    await WorldSceneUndeploymentModel.recordReplacements(
      "example.dcl.eth",
      [{ entityId: "deployment-a", baseParcel: "1,1" }],
      replacedAt
    )
    const [, sql] = namedQuery.mock.calls[0]
    sqlText = sql.text.replace(/\s+/g, " ")
    sqlValues = sql.values
  })

  it("should keep the newest replacing entity timestamp per deployment", () => {
    expect(sqlText).toContain(
      `"undeployed_at" = GREATEST("world_scene_undeployments"."undeployed_at", EXCLUDED."undeployed_at")`
    )
  })

  it("should leave the removal clock untouched", () => {
    expect(sqlText).not.toContain(`"removed_at"`)
  })

  it("should let the base reject, since the replacement occupies it", () => {
    expect(sqlValues).toContainEqual([true])
  })

  it("should stamp the replacing deployment's entity timestamp", () => {
    expect(sqlValues).toContainEqual(replacedAt)
  })
})

describe("when looking for a scene tombstone that supersedes a deployment", () => {
  let deployedAt: Date
  let emittedAt: Date
  let sqlText: string
  let sqlValues: unknown[]

  beforeEach(async () => {
    deployedAt = new Date("2026-08-03T12:00:00.000Z")
    emittedAt = new Date("2026-08-03T12:01:30.000Z")
    await WorldSceneUndeploymentModel.findSupersedingUndeployment(
      "example.dcl.eth",
      "deployment-a",
      "1,1",
      deployedAt,
      emittedAt
    )
    const [, sql] = namedQuery.mock.calls[0]
    sqlText = sql.text.replace(/\s+/g, " ")
    sqlValues = sql.values
  })

  it("should match the deployment identity against its entity timestamp on either stamp", () => {
    expect(sqlText).toMatch(
      /"deployment_id" = \$\d+ AND GREATEST\("undeployed_at", "removed_at"\) >= \$\d+/
    )
  })

  it("should never let an identity-only tombstone reject by base position", () => {
    expect(sqlText).toMatch(
      /"base_position" = \$\d+ AND "base_position_rejects" IS TRUE/
    )
  })

  it("should compare each base stamp on its own clock", () => {
    expect(sqlText).toMatch(
      /\("undeployed_at" >= \$\d+ OR "removed_at" >= \$\d+\)/
    )
  })

  it("should pass both the entity timestamp and the emission time", () => {
    expect(sqlValues).toEqual(expect.arrayContaining([deployedAt, emittedAt]))
  })
})
