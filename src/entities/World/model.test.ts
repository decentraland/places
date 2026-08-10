import WorldModel from "./model"

const namedQuery = jest.spyOn(WorldModel, "namedQuery")

beforeEach(() => {
  namedQuery.mockReset()
  namedQuery.mockResolvedValue([])
})

describe("when locking a world for a deployment", () => {
  beforeEach(async () => {
    await WorldModel.lockWorldForDeployment("Example.DCL.ETH")
  })

  it("should take a transaction-scoped advisory lock", () => {
    const [, sql] = namedQuery.mock.calls[0]

    expect(sql.text).toContain("pg_advisory_xact_lock")
  })

  it("should key the lock on the normalized world name so casing cannot split it", () => {
    const [, sql] = namedQuery.mock.calls[0]

    expect(sql.values).toContain("example.dcl.eth")
  })
})
