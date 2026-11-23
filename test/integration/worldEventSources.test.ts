import { SQL } from "decentraland-gatsby/dist/entities/Database/utils"

import { DeploymentToSqs } from "../../src/entities/CheckScenes/task/consumer"
import { extractSceneJsonData } from "../../src/entities/CheckScenes/task/extractSceneJsonData"
import {
  fetchWorldActiveScenes,
  fetchWorldActiveScenesAtPositions,
} from "../../src/entities/CheckScenes/task/fetchWorldActiveScenes"
import { handleWorldScenesUndeployment } from "../../src/entities/CheckScenes/task/handleWorldScenesUndeployment"
import { handleWorldSettingsChanged } from "../../src/entities/CheckScenes/task/handleWorldSettingsChanged"
import { handleWorldUndeployment } from "../../src/entities/CheckScenes/task/handleWorldUndeployment"
import { processEntityId } from "../../src/entities/CheckScenes/task/processEntityId"
import { taskRunnerSqs } from "../../src/entities/CheckScenes/task/taskRunnerSqs"
import PlaceModel from "../../src/entities/Place/model"
import WorldModel from "../../src/entities/World/model"
import {
  createWorldContentEntityScene,
  createWorldDeploymentMessage,
} from "../fixtures/deploymentEvent"
import {
  createWorldScenesUndeploymentEvent,
  createWorldUndeploymentEvent,
} from "../fixtures/undeploymentEvent"
import { createWorldSettingsChangedEvent } from "../fixtures/worldSettingsEvent"
import { cleanTables, closeTestDb, initTestDb } from "../setup/db"

jest.mock("../../src/entities/CheckScenes/task/processEntityId")
jest.mock("../../src/entities/CheckScenes/task/extractSceneJsonData")
jest.mock("../../src/entities/CheckScenes/task/fetchWorldActiveScenes")

jest.mock("../../src/entities/Slack/utils", () => ({
  notifyDowngradeRating: jest.fn(),
  notifyUpgradingRating: jest.fn(),
  notifyError: jest.fn(),
  notifyNewPlace: jest.fn(),
  notifyUpdatePlace: jest.fn(),
  notifyDisablePlaces: jest.fn(),
}))

jest.mock("../../src/entities/CheckScenes/utils", () => ({
  ...jest.requireActual("../../src/entities/CheckScenes/utils"),
  updateGenesisCityManifest: jest.fn(),
  fetchNameOwner: jest.fn().mockResolvedValue(undefined),
}))

const mockProcessEntityId = jest.mocked(processEntityId)
const mockExtractSceneJsonData = jest.mocked(extractSceneJsonData)
const mockFetchScenes = jest.mocked(fetchWorldActiveScenes)
const mockFetchScenesAtPositions = jest.mocked(
  fetchWorldActiveScenesAtPositions
)

const WORLDS_URL = "https://worlds-content-server.decentraland.org"
const OTHER_URL = "https://worlds.example.org"
const minute = 60 * 1000

type Deployment = {
  entityId: string
  title: string
  parcels: string[]
  server: string
  emittedAt: number
}

async function deliverDeployment(
  worldName: string,
  deployment: Deployment
): Promise<void> {
  const scene = createWorldContentEntityScene({
    worldName,
    title: deployment.title,
    base: deployment.parcels[0],
    parcels: deployment.parcels,
  })
  scene.timestamp = deployment.emittedAt - minute

  mockProcessEntityId.mockResolvedValueOnce(scene)
  mockExtractSceneJsonData.mockResolvedValueOnce({
    creator: null,
    runtimeVersion: null,
  })

  const message = createWorldDeploymentMessage({
    contentServerUrls: [deployment.server],
  })
  await taskRunnerSqs({
    ...message,
    entity: { ...message.entity, entityId: deployment.entityId },
    timestamp: deployment.emittedAt,
  } as DeploymentToSqs)
}

async function enabledTitles(worldName: string): Promise<string[]> {
  return (await PlaceModel.findEnabledWorldName(worldName))
    .map((place) => place.title as string)
    .sort()
}

describe("when a world name is served by several worlds servers", () => {
  let worldName: string
  let deployedAt: number
  let fromConfigured: Deployment
  let fromOther: Deployment
  let titles: string[]

  beforeAll(async () => {
    await initTestDb()
  })

  afterAll(async () => {
    await closeTestDb()
  })

  beforeEach(async () => {
    worldName = "shared.dcl.eth"
    deployedAt = Date.now() - 60 * minute
    fromConfigured = {
      entityId: "entity-configured",
      title: "Configured Scene",
      parcels: ["0,0"],
      server: WORLDS_URL,
      emittedAt: deployedAt,
    }
    fromOther = {
      entityId: "entity-other",
      title: "Other Scene",
      parcels: ["5,5"],
      server: OTHER_URL,
      emittedAt: deployedAt + 1000,
    }
    mockFetchScenes.mockResolvedValue({ deploymentIds: [], positions: [] })
    mockFetchScenesAtPositions.mockResolvedValue({
      deploymentIds: [],
      positions: [],
    })
    await deliverDeployment(worldName, fromConfigured)
    await deliverDeployment(worldName, fromOther)
  })

  afterEach(async () => {
    await cleanTables()
    jest.clearAllMocks()
  })

  describe("and the other server undeploys the world", () => {
    beforeEach(async () => {
      await handleWorldUndeployment(
        createWorldUndeploymentEvent(worldName, {
          timestamp: deployedAt + 10 * minute,
        }),
        OTHER_URL
      )
      titles = await enabledTitles(worldName)
    })

    it("should ask that server what the world still serves", () => {
      expect(mockFetchScenes).toHaveBeenCalledWith(worldName, OTHER_URL)
    })

    it("should keep the scene the configured server still serves", () => {
      expect(titles).toEqual(["Configured Scene"])
    })

    describe("and a deployment the configured server emitted before it arrives late", () => {
      beforeEach(async () => {
        await deliverDeployment(worldName, {
          entityId: "entity-configured-late",
          title: "Late Configured Scene",
          parcels: ["9,9"],
          server: WORLDS_URL,
          emittedAt: deployedAt + 5 * minute,
        })
        titles = await enabledTitles(worldName)
      })

      it("should list it, since the removal came from another server", () => {
        expect(titles).toEqual(["Configured Scene", "Late Configured Scene"])
      })
    })

    describe("and a deployment that server emitted before it arrives late", () => {
      beforeEach(async () => {
        await deliverDeployment(worldName, {
          entityId: "entity-other-late",
          title: "Late Other Scene",
          parcels: ["9,9"],
          server: OTHER_URL,
          emittedAt: deployedAt + 5 * minute,
        })
        titles = await enabledTitles(worldName)
      })

      it("should not recreate it", () => {
        expect(titles).toEqual(["Configured Scene"])
      })
    })
  })

  describe("and the configured server undeploys the world without naming itself", () => {
    beforeEach(async () => {
      await handleWorldUndeployment(
        createWorldUndeploymentEvent(worldName, {
          timestamp: deployedAt + 10 * minute,
        })
      )
      titles = await enabledTitles(worldName)
    })

    it("should ask the configured server what the world still serves", () => {
      expect(mockFetchScenes).toHaveBeenCalledWith(worldName, WORLDS_URL)
    })

    it("should keep the scene the other server still serves", () => {
      expect(titles).toEqual(["Other Scene"])
    })
  })

  describe("and a place predates recording its server", () => {
    beforeEach(async () => {
      await PlaceModel.namedQuery(
        "test_clear_place_source",
        SQL`UPDATE places SET content_server_url = NULL WHERE deployment_id = ${fromConfigured.entityId}`
      )
      await handleWorldUndeployment(
        createWorldUndeploymentEvent(worldName, {
          timestamp: deployedAt + 10 * minute,
        })
      )
      titles = await enabledTitles(worldName)
    })

    it("should treat it as the configured server's place", () => {
      expect(titles).toEqual(["Other Scene"])
    })
  })

  describe("and the other server undeploys a scene at parcels the configured server also uses", () => {
    beforeEach(async () => {
      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [
            { entityId: "entity-other", baseParcel: "5,5", parcels: ["5,5"] },
            { entityId: "entity-gone", baseParcel: "0,0", parcels: ["0,0"] },
          ],
          { timestamp: deployedAt + 10 * minute }
        ),
        OTHER_URL
      )
      titles = await enabledTitles(worldName)
    })

    it("should ask that server what it still serves at those parcels", () => {
      expect(mockFetchScenesAtPositions).toHaveBeenCalledWith(
        worldName,
        ["5,5", "0,0"],
        OTHER_URL
      )
    })

    it("should only disable the scenes deployed to that server", () => {
      expect(titles).toEqual(["Configured Scene"])
    })
  })

  describe("and its newest scene is on the other server", () => {
    let fetchMock: jest.SpyInstance
    let title: string | null | undefined

    beforeEach(() => {
      fetchMock = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(
          new Response(
            JSON.stringify({ title: "Changed Title", settings_version: 1 }),
            { status: 200 }
          )
        )
    })

    afterEach(() => {
      fetchMock.mockRestore()
    })

    describe("and the configured server changes the world settings", () => {
      beforeEach(async () => {
        await handleWorldSettingsChanged(
          createWorldSettingsChangedEvent({
            key: worldName,
            metadata: { worldName },
          })
        )
        title = (await WorldModel.findByWorldName(worldName))?.title
      })

      it("should leave the settings alone", () => {
        expect(title).not.toBe("Changed Title")
      })
    })

    describe("and the other server changes the world settings", () => {
      beforeEach(async () => {
        await handleWorldSettingsChanged(
          createWorldSettingsChangedEvent({
            key: worldName,
            metadata: { worldName },
          }),
          undefined,
          undefined,
          OTHER_URL
        )
        title = (await WorldModel.findByWorldName(worldName))?.title
      })

      it("should apply them", () => {
        expect(title).toBe("Changed Title")
      })
    })
  })

  describe("and the other server deploys a newer scene over the configured server's scene", () => {
    beforeEach(async () => {
      await deliverDeployment(worldName, {
        entityId: "entity-other-over",
        title: "Other Over Scene",
        parcels: ["0,0"],
        server: OTHER_URL,
        emittedAt: deployedAt + 2000,
      })
    })

    describe("and the configured server undeploys the world", () => {
      beforeEach(async () => {
        await handleWorldUndeployment(
          createWorldUndeploymentEvent(worldName, {
            timestamp: deployedAt + 10 * minute,
          })
        )
        titles = await enabledTitles(worldName)
      })

      it("should keep the replacement, which now belongs to the other server", () => {
        expect(titles).toEqual(["Other Over Scene", "Other Scene"])
      })
    })

    describe("and the other server undeploys the world", () => {
      beforeEach(async () => {
        await handleWorldUndeployment(
          createWorldUndeploymentEvent(worldName, {
            timestamp: deployedAt + 10 * minute,
          }),
          OTHER_URL
        )
        titles = await enabledTitles(worldName)
      })

      it("should remove every scene it deployed", () => {
        expect(titles).toEqual([])
      })
    })
  })

  describe("and its newest scene is a configured server place that predates recording its server", () => {
    let fetchMock: jest.SpyInstance
    let title: string | null | undefined

    beforeEach(async () => {
      await deliverDeployment(worldName, {
        entityId: "entity-configured-newest",
        title: "Newest Configured Scene",
        parcels: ["7,7"],
        server: WORLDS_URL,
        emittedAt: deployedAt + 3000,
      })
      await PlaceModel.namedQuery(
        "test_clear_place_source",
        SQL`UPDATE places SET content_server_url = NULL WHERE deployment_id = ${"entity-configured-newest"}`
      )
      fetchMock = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(
          new Response(
            JSON.stringify({ title: "Changed Title", settings_version: 1 }),
            { status: 200 }
          )
        )
      await handleWorldSettingsChanged(
        createWorldSettingsChangedEvent({
          key: worldName,
          metadata: { worldName },
        }),
        undefined,
        undefined,
        OTHER_URL
      )
      title = (await WorldModel.findByWorldName(worldName))?.title
    })

    afterEach(() => {
      fetchMock.mockRestore()
    })

    it("should skip the other server's settings", () => {
      expect(title).not.toBe("Changed Title")
    })
  })
})
