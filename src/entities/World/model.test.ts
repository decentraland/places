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

describe("when building the world list query", () => {
  const options = { only_favorites: false, categories: [] as string[] }

  it("should select the creator address of the latest enabled place", () => {
    const sql = WorldModel.buildSubQuery(options)

    expect(sql.text).toContain("lp.creator_address")
  })

  it("should not select the creator address when counting", () => {
    const sql = WorldModel.buildSubQuery(options, { forCount: true })

    expect(sql.text).not.toContain("lp.creator_address")
  })
})

describe("when finding a world by id with aggregates", () => {
  beforeEach(async () => {
    await WorldModel.findByIdWithAggregates("example.dcl.eth", {
      user: undefined,
    })
  })

  it("should select the creator address of the latest enabled place", () => {
    const [, sql] = namedQuery.mock.calls[0]

    expect(sql.text).toContain("lp.creator_address")
  })

  it("should expose the creator address from the lateral join", () => {
    const [, sql] = namedQuery.mock.calls[0]

    expect(sql.text).toContain("p.creator_address")
  })
})
