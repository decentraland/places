import {
  REBUILD_PLACE_ATTRIBUTES,
  createWorldPlaceOptions,
} from "./rebuildWorldPlacesOptions"

describe("when creating place options during a world rebuild", () => {
  it("should preserve the source deployment identity", () => {
    expect(
      createWorldPlaceOptions(
        "bafkreideployment",
        "https://worlds-content-server.decentraland.org",
        "0xcreator",
        "7",
        "example.dcl.eth"
      )
    ).toEqual({
      deploymentId: "bafkreideployment",
      url: "https://worlds-content-server.decentraland.org",
      creator: "0xcreator",
      sdk: "7",
      worldId: "example.dcl.eth",
    })
  })

  it("should persist the deployment identity on inserts and updates", () => {
    expect(REBUILD_PLACE_ATTRIBUTES).toContain("deployment_id")
  })
})
