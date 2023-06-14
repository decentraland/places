import { verifyWorldsIndexing } from "./verifyWorldsIndexing"

describe("verifyWorldsIndexing", () => {
  test("should return indexing for some worlds", async () => {
    const worldsVerified = await verifyWorldsIndexing([
      "024.dcl.eth",
      "041.dcl.eth",
      "044.dcl.eth",
    ])
    expect(worldsVerified).toEqual({
      indexNames: worldsVerified.indexNames,
      hasIndexNames: worldsVerified.hasIndexNames,
      nonIndexNames: worldsVerified.nonIndexNames,
      hasNonIndexNames: worldsVerified.hasNonIndexNames,
    })
  })
})
