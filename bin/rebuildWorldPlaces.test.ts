import { ContentEntityScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import {
  REBUILD_PLACE_ATTRIBUTES,
  createWorldInsertData,
  createWorldPlaceOptions,
} from "./rebuildWorldPlacesOptions"
import { contentEntitySceneGenesisPlaza } from "../src/__data__/contentEntitySceneGenesisPlaza"

describe("when building the world row during a rebuild", () => {
  let contentEntityScene: ContentEntityScene

  beforeEach(() => {
    contentEntityScene = {
      ...contentEntitySceneGenesisPlaza,
      metadata: {
        ...contentEntitySceneGenesisPlaza.metadata,
        display: {
          ...contentEntitySceneGenesisPlaza.metadata?.display,
          description:
            'Join us <link="decentraland://?position=0,0">click here</link>',
        },
      },
    } as ContentEntityScene
  })

  describe("and the scene description contains client-rendered markup", () => {
    it("should strip the markup before storing the world description", () => {
      expect(
        createWorldInsertData(
          "example.dcl.eth",
          contentEntityScene,
          "0xowner",
          false
        ).description
      ).toBe("Join us click here")
    })
  })
})

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
