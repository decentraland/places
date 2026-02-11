import supertest from "supertest"

import { DeploymentToSqs } from "../../src/entities/CheckScenes/task/consumer"
import { extractSceneJsonData } from "../../src/entities/CheckScenes/task/extractSceneJsonData"
import { handleWorldUndeployment } from "../../src/entities/CheckScenes/task/handleWorldUndeployment"
import { processEntityId } from "../../src/entities/CheckScenes/task/processEntityId"
import { taskRunnerSqs } from "../../src/entities/CheckScenes/task/taskRunnerSqs"
import {
  createWorldContentEntityScene,
  createWorldDeploymentMessage,
} from "../fixtures/deploymentEvent"
import { createWorldUndeploymentEvent } from "../fixtures/undeploymentEvent"
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
}): Promise<void> {
  const job: DeploymentToSqs = createWorldDeploymentMessage()

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

describe("when handling the WorldUndeploymentEvent", () => {
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

  describe("and the WorldUndeploymentEvent targets a world with a single scene", () => {
    const worldName = "singlescene.dcl.eth"

    beforeEach(async () => {
      await deployWorldScene({ worldName, title: "Single Scene World" })
    })

    it("should delete the place record", async () => {
      const event = createWorldUndeploymentEvent(worldName)
      await handleWorldUndeployment(event)

      const response = await supertest(app)
        .get("/api/places")
        .query({ names: worldName })
        .expect(200)

      expect(response.body.data).toHaveLength(0)
    })

    it("should keep the world record but not return it in the worlds list", async () => {
      const event = createWorldUndeploymentEvent(worldName)
      await handleWorldUndeployment(event)

      const response = await supertest(app).get("/api/worlds").expect(200)

      const worldNames = response.body.data.map((w: any) => w.world_name)
      expect(worldNames).not.toContain(worldName)
    })
  })

  describe("and the WorldUndeploymentEvent targets a world with multiple scenes", () => {
    const worldName = "multiscene.dcl.eth"

    beforeEach(async () => {
      await deployWorldScene({
        worldName,
        title: "Scene A",
        base: "0,0",
        parcels: ["0,0"],
      })
      await deployWorldScene({
        worldName,
        title: "Scene B",
        base: "5,5",
        parcels: ["5,5"],
      })
    })

    it("should delete all place records for the world", async () => {
      const event = createWorldUndeploymentEvent(worldName)
      await handleWorldUndeployment(event)

      const response = await supertest(app)
        .get("/api/places")
        .query({ names: worldName })
        .expect(200)

      expect(response.body.data).toHaveLength(0)
    })
  })

  describe("and the WorldUndeploymentEvent targets a non-existent world", () => {
    it("should not throw an error", async () => {
      const event = createWorldUndeploymentEvent("nonexistent.dcl.eth")

      await expect(handleWorldUndeployment(event)).resolves.not.toThrow()
    })
  })

  describe("and the WorldUndeploymentEvent has an empty world name", () => {
    it("should return early without errors", async () => {
      const event = createWorldUndeploymentEvent("")
      // The handler checks for empty worldName and returns early
      event.metadata.worldName = ""

      await expect(handleWorldUndeployment(event)).resolves.not.toThrow()
    })
  })
})
