import { verifyWorldsIndexing } from "./verifyWorldsIndexing"

describe("verifyWorldsIndexing", () => {
  test("should return indexing for some worlds", async () => {
    const worldsVerified = await verifyWorldsIndexing([
      "024.dcl.eth",
      "041.dcl.eth",
      "044.dcl.eth",
    ])
    expect(worldsVerified).toEqual([
      {
        dclName: "024.dcl.eth",
        shouldBeIndexed: worldsVerified.find(
          (world) => world.dclName === "024.dcl.eth"
        )?.shouldBeIndexed,
      },
      {
        dclName: "041.dcl.eth",
        shouldBeIndexed: worldsVerified.find(
          (world) => world.dclName === "041.dcl.eth"
        )?.shouldBeIndexed,
      },
      {
        dclName: "044.dcl.eth",
        shouldBeIndexed: worldsVerified.find(
          (world) => world.dclName === "044.dcl.eth"
        )?.shouldBeIndexed,
      },
    ])
  })
})
