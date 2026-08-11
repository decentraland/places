import WorldSceneUndeploymentModel from "./model"

const namedQuery = jest.spyOn(WorldSceneUndeploymentModel, "namedQuery")

beforeEach(() => {
  namedQuery.mockReset()
  namedQuery.mockResolvedValue([])
})

describe("when recording scene undeployments", () => {
  let eventTimestamp: number

  beforeEach(() => {
    eventTimestamp = Date.parse("2026-08-03T12:00:00.000Z")
  })

  describe("and the event carries no scenes", () => {
    beforeEach(async () => {
      await WorldSceneUndeploymentModel.recordScenes(
        "example.dcl.eth",
        [],
        eventTimestamp
      )
    })

    it("should not run a query", () => {
      expect(namedQuery).not.toHaveBeenCalled()
    })
  })

  describe("and the event carries scenes", () => {
    beforeEach(async () => {
      await WorldSceneUndeploymentModel.recordScenes(
        "Example.DCL.ETH",
        [
          { entityId: "deployment-a", baseParcel: "1,1" },
          { entityId: "deployment-b", baseParcel: "2,2" },
        ],
        eventTimestamp
      )
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
      await WorldSceneUndeploymentModel.recordScenes(
        "example.dcl.eth",
        [
          { entityId: "deployment-a", baseParcel: "1,1" },
          { entityId: "deployment-a", baseParcel: "1,1" },
        ],
        eventTimestamp
      )
      const [, sql] = namedQuery.mock.calls[0]
      deploymentIds =
        sql.values.find((value): value is string[] => Array.isArray(value)) ??
        []
    })

    it("should include the deployment only once in the bulk upsert", () => {
      expect(deploymentIds).toEqual(["deployment-a"])
    })
  })

  describe("and the event carries thousands of scenes", () => {
    let bindValues: unknown[]
    let scenes: Array<{ entityId: string; baseParcel: string }>

    beforeEach(async () => {
      scenes = Array.from({ length: 5_000 }, (_, index) => ({
        entityId: `deployment-${index}`,
        baseParcel: `${index},0`,
      }))

      await WorldSceneUndeploymentModel.recordScenes(
        "example.dcl.eth",
        scenes,
        eventTimestamp
      )
      const [, sql] = namedQuery.mock.calls[0]
      bindValues = sql.values
    })

    it("should keep the bind parameter count constant", () => {
      expect(bindValues).toHaveLength(4)
    })

    it("should pass every deployment id in one array parameter", () => {
      expect(bindValues).toContainEqual(scenes.map((scene) => scene.entityId))
    })

    it("should pass every base position in one array parameter", () => {
      expect(bindValues).toContainEqual(scenes.map((scene) => scene.baseParcel))
    })
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
      `("deployment_id" = $2 OR "base_position" = $3)`
    )
  })

  it("should only match undeployments at or after the deployment timestamp", () => {
    const [, sql] = namedQuery.mock.calls[0]

    expect(sql.text.replace(/\s+/g, " ")).toContain(`"undeployed_at" >= $`)
  })
})
