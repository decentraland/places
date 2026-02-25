import { AuthLinkType } from "@dcl/schemas/dist/misc/auth-chain"
import { EntityType } from "@dcl/schemas/dist/platform/entity"
import {
  ContentEntityScene,
  SceneContentRating,
} from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { DeploymentToSqs } from "../../src/entities/CheckScenes/task/consumer"

/**
 * Creates a DeploymentToSqs message for a world scene deployment.
 */
export function createWorldDeploymentMessage(
  overrides: Partial<DeploymentToSqs> = {}
): DeploymentToSqs {
  return {
    entity: {
      entityId: "bafkreigmbmwtfptb7uocny5fpnnxl2vvbzxxzbdkzpmneqgbjw2if62f2e",
      authChain: [
        {
          signature: "",
          type: AuthLinkType.SIGNER,
          payload: "0x1234567890abcdef1234567890abcdef12345678",
        },
      ],
    },
    contentServerUrls: ["https://worlds-content-server.decentraland.org"],
    ...overrides,
  }
}

/**
 * Creates a ContentEntityScene fixture for a world scene.
 * This represents the data returned from a content server.
 */
export function createWorldContentEntityScene(
  overrides: {
    worldName?: string
    title?: string
    description?: string
    base?: string
    parcels?: string[]
    contentRating?: string
    tags?: string[]
    optOut?: boolean
    dclName?: boolean
  } = {}
): ContentEntityScene {
  const worldName = overrides.worldName ?? "testworld.dcl.eth"
  const base = overrides.base ?? "0,0"
  const parcels = overrides.parcels ?? ["0,0"]

  return {
    version: "v3",
    type: EntityType.SCENE,
    pointers: parcels,
    timestamp: Date.now(),
    content: [
      {
        file: "bin/game.js",
        hash: "bafkreidxb345bwbdtiuyghqn5dizgxcavwnvgcyw5rzegfn2gp2rgv334e",
      },
      {
        file: "scene.json",
        hash: "bafkreihrwcmumhfsqzalxdjyynvz5cd53kwxeejtg66tvcxnneys3ksf4y",
      },
      {
        file: "scene-thumbnail.png",
        hash: "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
      },
    ],
    metadata: {
      display: {
        title: overrides.title ?? "Test World Scene",
        favicon: "favicon_asset",
        navmapThumbnail: "scene-thumbnail.png",
      },
      owner: "0x1234567890abcdef1234567890abcdef12345678",
      contact: {
        name: "test-creator",
        email: "",
      },
      main: "bin/game.js",
      tags: overrides.tags ?? [],
      scene: {
        parcels,
        base,
      },
      worldConfiguration: overrides.dclName
        ? { dclName: worldName }
        : {
            name: worldName,
            ...(overrides.optOut ? { placesConfig: { optOut: true } } : {}),
          },
      ...(overrides.contentRating
        ? {
            policy: {
              contentRating:
                overrides.contentRating as unknown as SceneContentRating,
              fly: true,
              voiceEnabled: true,
              blacklist: [],
              teleportPosition: "",
            },
          }
        : {}),
    },
  }
}

/**
 * Creates a ContentEntityScene fixture for a multi-scene world deployment.
 * Represents a second scene in the same world at a different base position.
 */
export function createWorldContentEntitySceneSecondScene(
  worldName = "testworld.dcl.eth"
): ContentEntityScene {
  return createWorldContentEntityScene({
    worldName,
    title: "Second Scene",
    base: "1,0",
    parcels: ["1,0"],
  })
}
