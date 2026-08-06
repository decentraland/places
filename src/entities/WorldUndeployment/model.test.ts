import WorldUndeploymentModel from "./model"

const namedQuery = jest.spyOn(WorldUndeploymentModel, "namedQuery")

beforeEach(() => {
  namedQuery.mockReset()
  namedQuery.mockResolvedValue([])
})

describe("when recording a world undeployment watermark", () => {
  let eventTimestamp: number

  beforeEach(async () => {
    eventTimestamp = Date.parse("2026-08-03T12:00:00.000Z")
    await WorldUndeploymentModel.recordWatermark(
      "Example.DCL.ETH",
      eventTimestamp
    )
  })

  it("should keep the newest undeployment timestamp for the world", () => {
    const [, sql] = namedQuery.mock.calls[0]

    expect(sql.text.replace(/\s+/g, " ")).toContain(
      `ON CONFLICT ("world_id") DO UPDATE SET "undeployed_at" = GREATEST(`
    )
  })

  it("should normalize the world id", () => {
    const [, sql] = namedQuery.mock.calls[0]

    expect(sql.values).toContain("example.dcl.eth")
  })

  it("should record the event timestamp rather than the processing time", () => {
    const [, sql] = namedQuery.mock.calls[0]

    expect(sql.values).toContainEqual(new Date(eventTimestamp))
  })
})

describe("when looking for a world undeployment that supersedes a deployment", () => {
  beforeEach(async () => {
    await WorldUndeploymentModel.findSupersedingUndeployment(
      "example.dcl.eth",
      new Date("2026-08-03T12:00:00.000Z")
    )
  })

  it("should only match undeployments at or after the deployment timestamp", () => {
    const [, sql] = namedQuery.mock.calls[0]

    expect(sql.text.replace(/\s+/g, " ")).toContain(`"undeployed_at" >= $`)
  })
})
