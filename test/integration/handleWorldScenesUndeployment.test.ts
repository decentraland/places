import supertest from "supertest"

import { DeploymentToSqs } from "../../src/entities/CheckScenes/task/consumer"
import { extractSceneJsonData } from "../../src/entities/CheckScenes/task/extractSceneJsonData"
import { handleWorldScenesUndeployment } from "../../src/entities/CheckScenes/task/handleWorldScenesUndeployment"
import { processEntityId } from "../../src/entities/CheckScenes/task/processEntityId"
import { taskRunnerSqs } from "../../src/entities/CheckScenes/task/taskRunnerSqs"
import {
  createWorldContentEntityScene,
  createWorldDeploymentMessage,
} from "../fixtures/deploymentEvent"
import { createWorldScenesUndeploymentEvent } from "../fixtures/undeploymentEvent"
import { cleanTables, closeTestDb, initTestDb } from "../setup/db"
import { createTestApp } from "../setup/server"

// Mock external HTTP calls
jest.mock("../../src/entities/CheckScenes/task/processEntityId")
jest.mock("../../src/entities/CheckScenes/task/extractSceneJsonData")

// Mock Slack notifications to prevent HTTP calls during tests
jest.mock("../../src/entities/Slack/utils", () => ({
  notifyDowngradeRating: jest.fn(),
  notifyUpgradingRating: jest.fn(),
  notifyError: jest.fn(),
  notifyNewPlace: jest.fn(),
  notifyUpdatePlace: jest.fn(),
  notifyDisablePlaces: jest.fn(),
}))

// Mock the genesis city manifest update (requires S3)
jest.mock("../../src/entities/CheckScenes/utils", () => ({
  ...jest.requireActual("../../src/entities/CheckScenes/utils"),
  updateGenesisCityManifest: jest.fn(),
}))

// Mock modules with persistent timers to prevent Jest from hanging
jest.mock("../../src/modules/hotScenes", () => ({
  getHotScenes: jest.fn().mockReturnValue([]),
}))
jest.mock("../../src/modules/sceneStats", () => ({
  getSceneStats: jest.fn().mockResolvedValue({}),
}))
jest.mock("../../src/modules/worldsLiveData", () => ({
  getWorldsLiveData: jest.fn().mockResolvedValue({
    perWorld: [],
    totalUsers: 0,
  }),
}))

const mockProcessEntityId = processEntityId as jest.MockedFunction<
  typeof processEntityId
>
const mockExtractSceneJsonData = extractSceneJsonData as jest.MockedFunction<
  typeof extractSceneJsonData
>

const app = createTestApp()

/**
 * Helper to deploy a world scene, setting up the mocks and invoking
 * the deployment task runner.
 */
async function deployWorldScene(options: {
  worldName: string
  title?: string
  base?: string
  parcels?: string[]
  entityId?: string
}): Promise<void> {
  const job: DeploymentToSqs = createWorldDeploymentMessage(
    options.entityId
      ? {
          entity: {
            entityId: options.entityId,
            authChain: [
              {
                signature: "",
                type: "SIGNER" as any,
                payload: "0x1234567890abcdef1234567890abcdef12345678",
              },
            ],
          },
        }
      : undefined
  )

  const scene = createWorldContentEntityScene({
    worldName: options.worldName,
    title: options.title ?? "Test Scene",
    base: options.base ?? "0,0",
    parcels: options.parcels ?? ["0,0"],
  })

  mockProcessEntityId.mockResolvedValueOnce(scene)
  mockExtractSceneJsonData.mockResolvedValueOnce({
    creator: "0x1234567890abcdef1234567890abcdef12345678",
    runtimeVersion: "7.0.0",
  })

  await taskRunnerSqs(job)
}

describe("when handling the WorldScenesUndeploymentEvent", () => {
  beforeAll(async () => {
    await initTestDb()
  })

  afterAll(async () => {
    await closeTestDb()
  })

  afterEach(async () => {
    await cleanTables()
    jest.clearAllMocks()
  })

  describe("and the WorldScenesUndeploymentEvent targets a single scene", () => {
    const worldName = "singlescene.dcl.eth"

    beforeEach(async () => {
      await deployWorldScene({
        worldName,
        title: "Scene to Undeploy",
        base: "20,24",
        parcels: ["20,24"],
      })
    })

    it("should delete the place record at the specified base parcel", async () => {
      const event = createWorldScenesUndeploymentEvent(worldName, [
        { entityId: "entity-1", baseParcel: "20,24" },
      ])
      await handleWorldScenesUndeployment(event)

      const response = await supertest(app)
        .get("/api/places")
        .query({ names: worldName })
        .expect(200)

      expect(response.body.data).toHaveLength(0)
    })

    it("should not return the world in the worlds list after the last scene is removed", async () => {
      const event = createWorldScenesUndeploymentEvent(worldName, [
        { entityId: "entity-1", baseParcel: "20,24" },
      ])
      await handleWorldScenesUndeployment(event)

      const response = await supertest(app).get("/api/worlds").expect(200)

      const worldNames = response.body.data.map((w: any) => w.world_name)
      expect(worldNames).not.toContain(worldName)
    })
  })

  describe("and the WorldScenesUndeploymentEvent targets only some scenes of a multi-scene world", () => {
    const worldName = "partialundeploy.dcl.eth"

    beforeEach(async () => {
      await deployWorldScene({
        worldName,
        title: "Scene A - Keep",
        base: "0,0",
        parcels: ["0,0"],
      })
      await deployWorldScene({
        worldName,
        title: "Scene B - Remove",
        base: "5,5",
        parcels: ["5,5"],
      })
    })

    it("should only delete the place at the specified base parcel", async () => {
      const event = createWorldScenesUndeploymentEvent(worldName, [
        { entityId: "entity-b", baseParcel: "5,5" },
      ])
      await handleWorldScenesUndeployment(event)

      const response = await supertest(app)
        .get("/api/places")
        .query({ names: worldName })
        .expect(200)

      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].base_position).toBe("0,0")
    })

    it("should still return the world in the worlds list", async () => {
      const event = createWorldScenesUndeploymentEvent(worldName, [
        { entityId: "entity-b", baseParcel: "5,5" },
      ])
      await handleWorldScenesUndeployment(event)

      const response = await supertest(app)
        .get(`/api/worlds/${worldName}`)
        .expect(200)

      expect(response.body.ok).toBe(true)
      expect(response.body.data.world_name).toBe(worldName)
    })
  })

  describe("and the WorldScenesUndeploymentEvent targets multiple scenes at once", () => {
    const worldName = "multiremove.dcl.eth"

    beforeEach(async () => {
      await deployWorldScene({
        worldName,
        title: "Scene X",
        base: "10,10",
        parcels: ["10,10"],
      })
      await deployWorldScene({
        worldName,
        title: "Scene Y",
        base: "20,20",
        parcels: ["20,20"],
      })
      await deployWorldScene({
        worldName,
        title: "Scene Z",
        base: "30,30",
        parcels: ["30,30"],
      })
    })

    it("should delete all targeted scenes while preserving the rest", async () => {
      const event = createWorldScenesUndeploymentEvent(worldName, [
        { entityId: "entity-x", baseParcel: "10,10" },
        { entityId: "entity-y", baseParcel: "20,20" },
      ])
      await handleWorldScenesUndeployment(event)

      const response = await supertest(app)
        .get("/api/places")
        .query({ names: worldName })
        .expect(200)

      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].base_position).toBe("30,30")
    })
  })

  describe("and the WorldScenesUndeploymentEvent targets a non-existent base parcel", () => {
    const worldName = "nonematch.dcl.eth"

    beforeEach(async () => {
      await deployWorldScene({
        worldName,
        title: "Existing Scene",
        base: "0,0",
        parcels: ["0,0"],
      })
    })

    it("should not affect existing places", async () => {
      const event = createWorldScenesUndeploymentEvent(worldName, [
        { entityId: "entity-nonexistent", baseParcel: "99,99" },
      ])
      await handleWorldScenesUndeployment(event)

      const response = await supertest(app)
        .get("/api/places")
        .query({ names: worldName })
        .expect(200)

      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].title).toBe("Existing Scene")
    })
  })

  describe("and the WorldScenesUndeploymentEvent has a timestamp older than the deployment", () => {
    const worldName = "racecondition.dcl.eth"

    beforeEach(async () => {
      await deployWorldScene({
        worldName,
        title: "Re-deployed Scene",
        base: "10,10",
        parcels: ["10,10"],
      })
    })

    it("should not delete the place record", async () => {
      // Simulate a stale undeployment event with a timestamp before the deployment
      const staleTimestamp = Date.now() - 60_000
      const event = createWorldScenesUndeploymentEvent(
        worldName,
        [{ entityId: "entity-stale", baseParcel: "10,10" }],
        { timestamp: staleTimestamp }
      )
      await handleWorldScenesUndeployment(event)

      const response = await supertest(app)
        .get("/api/places")
        .query({ names: worldName })
        .expect(200)

      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].title).toBe("Re-deployed Scene")
    })
  })

  describe("and the WorldScenesUndeploymentEvent has an empty scenes array", () => {
    it("should return early without errors", async () => {
      const event = createWorldScenesUndeploymentEvent("anyworld.dcl.eth", [])
      // The handler checks for empty scenes and returns early

      await expect(handleWorldScenesUndeployment(event)).resolves.not.toThrow()
    })
  })
})
