import WorldSceneUndeploymentModel from "./model"

const namedQuery = jest.spyOn(WorldSceneUndeploymentModel, "namedQuery")

beforeEach(() => {
  namedQuery.mockReset()
  namedQuery.mockResolvedValue([])
})

describe("when recording scene undeployments", () => {
  let undeployedAt: Date

  beforeEach(() => {
    undeployedAt = new Date(Date.parse("2026-08-03T12:00:00.000Z"))
  })

  describe("and the event carries no scenes", () => {
    beforeEach(async () => {
      await WorldSceneUndeploymentModel.recordScenes("example.dcl.eth", [])
    })

    it("should not run a query", () => {
      expect(namedQuery).not.toHaveBeenCalled()
    })
  })

  describe("and the event carries scenes", () => {
    beforeEach(async () => {
      await WorldSceneUndeploymentModel.recordScenes("Example.DCL.ETH", [
        {
          entityId: "deployment-a",
          baseParcel: "1,1",
          undeployedAt,
          basePositionRejects: true,
        },
        {
          entityId: "deployment-b",
          baseParcel: "2,2",
          undeployedAt,
          basePositionRejects: true,
        },
      ])
    })

    it("should keep the newest undeployment timestamp per deployment", () => {
      const [, sql] = namedQuery.mock.calls[0]

      expect(sql.text.replace(/\s+/g, " ")).toContain(
        `ON CONFLICT ("world_id", "deployment_id") DO UPDATE`
      )
    })

    it("should record every undeployed scene", () => {
      const [, sql] = namedQuery.mock.calls[0]

      expect(sql.values).toEqual(
        expect.arrayContaining([
          ["deployment-a", "deployment-b"],
          ["1,1", "2,2"],
        ])
      )
    })

    it("should normalize the world id", () => {
      const [, sql] = namedQuery.mock.calls[0]

      expect(sql.values).toContain("example.dcl.eth")
    })
  })

  describe("and the event repeats a deployment", () => {
    let deploymentIds: string[]

    beforeEach(async () => {
      await WorldSceneUndeploymentModel.recordScenes("example.dcl.eth", [
        {
          entityId: "deployment-a",
          baseParcel: "1,1",
          undeployedAt,
          basePositionRejects: true,
        },
        {
          entityId: "deployment-a",
          baseParcel: "1,1",
          undeployedAt,
          basePositionRejects: true,
        },
      ])
      const [, sql] = namedQuery.mock.calls[0]
      deploymentIds =
        sql.values.find((value): value is string[] => Array.isArray(value)) ??
        []
    })

    it("should include the deployment only once in the bulk upsert", () => {
      expect(deploymentIds).toEqual(["deployment-a"])
    })

    it("should dedupe every array in lockstep, so unnest cannot pad with NULL", () => {
      const [, sql] = namedQuery.mock.calls[0]
      const arrays = sql.values.filter((value): value is unknown[] =>
        Array.isArray(value)
      )

      expect(arrays.map((array) => array.length)).toEqual([1, 1, 1, 1])
    })
  })

  describe("and the event carries thousands of scenes", () => {
    let bindValues: unknown[]
    let scenes: Array<{
      entityId: string
      baseParcel: string
      undeployedAt: Date
      basePositionRejects: boolean
    }>

    beforeEach(async () => {
      scenes = Array.from({ length: 5_000 }, (_, index) => ({
        entityId: `deployment-${index}`,
        baseParcel: `${index},0`,
        undeployedAt,
        basePositionRejects: true,
      }))

      await WorldSceneUndeploymentModel.recordScenes("example.dcl.eth", scenes)
      const [, sql] = namedQuery.mock.calls[0]
      bindValues = sql.values
    })

    it("should keep the bind parameter count constant", () => {
      expect(bindValues).toHaveLength(5)
    })

    it("should pass every deployment id in one array parameter", () => {
      expect(bindValues).toContainEqual(scenes.map((scene) => scene.entityId))
    })

    it("should pass every base position in one array parameter", () => {
      expect(bindValues).toContainEqual(scenes.map((scene) => scene.baseParcel))
    })

    it("should pass one timestamp per scene", () => {
      expect(bindValues).toContainEqual(
        scenes.map((scene) => scene.undeployedAt)
      )
    })
  })

  describe("and the scenes were deployed at different times", () => {
    let olderUndeployedAt: Date

    beforeEach(async () => {
      olderUndeployedAt = new Date(Date.parse("2026-07-30T10:00:00.000Z"))

      await WorldSceneUndeploymentModel.recordScenes("example.dcl.eth", [
        {
          entityId: "deployment-a",
          baseParcel: "1,1",
          undeployedAt: olderUndeployedAt,
          basePositionRejects: true,
        },
        {
          entityId: "deployment-b",
          baseParcel: "2,2",
          undeployedAt,
          basePositionRejects: true,
        },
      ])
    })

    it("should stamp each deployment with its own timestamp", () => {
      const [, sql] = namedQuery.mock.calls[0]

      expect(sql.values).toContainEqual([olderUndeployedAt, undeployedAt])
    })
  })
})

describe("when a removed scene's base is still served", () => {
  beforeEach(async () => {
    await WorldSceneUndeploymentModel.recordScenes("example.dcl.eth", [
      {
        entityId: "deployment-removed",
        baseParcel: "0,0",
        undeployedAt: new Date(Date.parse("2026-08-03T12:00:00.000Z")),
        basePositionRejects: false,
      },
    ])
  })

  it("should still record the identity tombstone", () => {
    const [, sql] = namedQuery.mock.calls[0]

    expect(sql.values).toContainEqual(["deployment-removed"])
  })

  it("should mark the base as unable to reject", () => {
    const [, sql] = namedQuery.mock.calls[0]

    expect(sql.values).toContainEqual([false])
  })
})

describe("when looking for a scene undeployment that supersedes a deployment", () => {
  beforeEach(async () => {
    await WorldSceneUndeploymentModel.findSupersedingUndeployment(
      "example.dcl.eth",
      "deployment-a",
      "1,1",
      new Date("2026-08-03T12:00:00.000Z")
    )
  })

  it("should match the deployment identity or the scene base position", () => {
    const [, sql] = namedQuery.mock.calls[0]

    expect(sql.text.replace(/\s+/g, " ")).toContain(
      `( "deployment_id" = $2 OR ("base_position" = $3 AND "base_position_rejects" IS TRUE) )`
    )
  })

  it("should never let an identity-only tombstone reject by base position", () => {
    const [, sql] = namedQuery.mock.calls[0]

    expect(sql.text.replace(/\s+/g, " ")).toContain(
      `"base_position_rejects" IS TRUE`
    )
  })

  it("should only match undeployments at or after the deployment timestamp", () => {
    const [, sql] = namedQuery.mock.calls[0]

    expect(sql.text.replace(/\s+/g, " ")).toContain(`"undeployed_at" >= $`)
  })
})
