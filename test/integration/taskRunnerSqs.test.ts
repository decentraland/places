import supertest from "supertest"

import { DeploymentToSqs } from "../../src/entities/CheckScenes/task/consumer"
import { extractSceneJsonData } from "../../src/entities/CheckScenes/task/extractSceneJsonData"
import { processEntityId } from "../../src/entities/CheckScenes/task/processEntityId"
import { taskRunnerSqs } from "../../src/entities/CheckScenes/task/taskRunnerSqs"
import {
  createWorldContentEntityScene,
  createWorldDeploymentMessage,
} from "../fixtures/deploymentEvent"
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

describe("taskRunnerSqs integration", () => {
  beforeAll(async () => {
    await initTestDb()
  })

  afterAll(async () => {
    await closeTestDb()
  })

  afterEach(async () => {
    await cleanTables()
    jest.resetAllMocks()
  })

  describe("when a world scene deployment is received for a new world", () => {
    let job: DeploymentToSqs

    beforeEach(async () => {
      job = createWorldDeploymentMessage()

      const contentEntityScene = createWorldContentEntityScene({
        worldName: "newworld.dcl.eth",
        title: "New World Scene",
      })

      mockProcessEntityId.mockResolvedValueOnce(contentEntityScene)
      mockExtractSceneJsonData.mockResolvedValueOnce({
        creator: "0x1234567890abcdef1234567890abcdef12345678",
        runtimeVersion: "7.0.0",
      })

      await taskRunnerSqs(job)
    })

    it("should create the world queryable via the API", async () => {
      const response = await supertest(app)
        .get("/api/worlds/newworld.dcl.eth")
        .expect(200)

      expect(response.body.ok).toBe(true)
      expect(response.body.data.world_name).toBe("newworld.dcl.eth")
    })

    it("should create a new place linked to that world", async () => {
      const response = await supertest(app)
        .get("/api/places")
        .query({ names: "newworld.dcl.eth" })
        .expect(200)

      expect(response.body.ok).toBe(true)
      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].title).toBe("New World Scene")
      expect(response.body.data[0].world).toBe(true)
      expect(response.body.data[0].world_name).toBe("newworld.dcl.eth")
      expect(response.body.data[0].world_id).toBe("newworld.dcl.eth")
    })

    it("should have the place queryable via GET /api/places/:place_id", async () => {
      const placesResponse = await supertest(app)
        .get("/api/places")
        .query({ names: "newworld.dcl.eth" })
        .expect(200)

      const placeId = placesResponse.body.data[0].id

      const response = await supertest(app)
        .get(`/api/places/${placeId}`)
        .expect(200)

      expect(response.body.ok).toBe(true)
      expect(response.body.data.title).toBe("New World Scene")
      expect(response.body.data.world).toBe(true)
      expect(response.body.data.world_name).toBe("newworld.dcl.eth")
    })
  })

  describe("when a world scene deployment is received for an existing world with an existing scene", () => {
    let job: DeploymentToSqs

    beforeEach(async () => {
      // First deployment creates the world and place
      job = createWorldDeploymentMessage()

      const initialScene = createWorldContentEntityScene({
        worldName: "existingworld.dcl.eth",
        title: "Original Scene",
      })

      mockProcessEntityId.mockResolvedValueOnce(initialScene)
      mockExtractSceneJsonData.mockResolvedValueOnce({
        creator: null,
        runtimeVersion: null,
      })

      await taskRunnerSqs(job)

      // Second deployment updates the existing scene
      const updatedScene = createWorldContentEntityScene({
        worldName: "existingworld.dcl.eth",
        title: "Updated Scene",
        description: "Updated description",
      })

      mockProcessEntityId.mockResolvedValueOnce(updatedScene)
      mockExtractSceneJsonData.mockResolvedValueOnce({
        creator: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        runtimeVersion: "7.1.0",
      })

      await taskRunnerSqs(job)
    })

    it("should update the existing place without creating a duplicate", async () => {
      const response = await supertest(app)
        .get("/api/places")
        .query({ names: "existingworld.dcl.eth" })
        .expect(200)

      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].title).toBe("Updated Scene")
    })

    it("should preserve the world record", async () => {
      const response = await supertest(app)
        .get("/api/worlds/existingworld.dcl.eth")
        .expect(200)

      expect(response.body.ok).toBe(true)
      expect(response.body.data.world_name).toBe("existingworld.dcl.eth")
    })

    it("should reflect updated data via the place detail API", async () => {
      const placesResponse = await supertest(app)
        .get("/api/places")
        .query({ names: "existingworld.dcl.eth" })
        .expect(200)

      const placeId = placesResponse.body.data[0].id

      const response = await supertest(app)
        .get(`/api/places/${placeId}`)
        .expect(200)

      expect(response.body.data.title).toBe("Updated Scene")
    })
  })

  describe("when a world scene deployment has opt-out set", () => {
    let job: DeploymentToSqs

    beforeEach(async () => {
      job = createWorldDeploymentMessage()

      const optOutScene = createWorldContentEntityScene({
        worldName: "optoutworld.dcl.eth",
        title: "Opt Out World",
        optOut: true,
      })

      mockProcessEntityId.mockResolvedValueOnce(optOutScene)
      mockExtractSceneJsonData.mockResolvedValueOnce({
        creator: null,
        runtimeVersion: null,
      })

      await taskRunnerSqs(job)
    })

    it("should not return the disabled place via the places API", async () => {
      const response = await supertest(app)
        .get("/api/places")
        .query({ names: "optoutworld.dcl.eth" })
        .expect(200)

      expect(response.body.data).toHaveLength(0)
    })

    it("should create the world with show_in_places set to false", async () => {
      const response = await supertest(app)
        .get("/api/worlds/optoutworld.dcl.eth")
        .expect(200)

      expect(response.body.ok).toBe(true)
      expect(response.body.data.show_in_places).toBe(false)
    })
  })

  describe("when a world scene deployment has a content rating", () => {
    let job: DeploymentToSqs

    beforeEach(async () => {
      job = createWorldDeploymentMessage()

      const ratedScene = createWorldContentEntityScene({
        worldName: "ratedworld.dcl.eth",
        title: "Rated World",
        contentRating: "T",
      })

      mockProcessEntityId.mockResolvedValueOnce(ratedScene)
      mockExtractSceneJsonData.mockResolvedValueOnce({
        creator: null,
        runtimeVersion: null,
      })

      await taskRunnerSqs(job)
    })

    it("should create the place with the specified content rating", async () => {
      const response = await supertest(app)
        .get("/api/places")
        .query({ names: "ratedworld.dcl.eth" })
        .expect(200)

      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].content_rating).toBe("T")
    })
  })

  describe("when querying a world place by position", () => {
    let job: DeploymentToSqs

    beforeEach(async () => {
      job = createWorldDeploymentMessage()

      // Deploy a scene with multiple parcels
      const multiParcelScene = createWorldContentEntityScene({
        worldName: "multiparcel.dcl.eth",
        title: "Multi Parcel Scene",
        base: "0,0",
        parcels: ["0,0", "0,1", "1,0", "1,1"],
      })

      mockProcessEntityId.mockResolvedValueOnce(multiParcelScene)
      mockExtractSceneJsonData.mockResolvedValueOnce({
        creator: null,
        runtimeVersion: null,
      })

      await taskRunnerSqs(job)
    })

    describe("and the position matches one of the scene's parcels", () => {
      it("should return the place", async () => {
        const response = await supertest(app)
          .get("/api/places")
          .query({ names: "multiparcel.dcl.eth", positions: "1,0" })
          .expect(200)

        expect(response.body.data).toHaveLength(1)
        expect(response.body.data[0].title).toBe("Multi Parcel Scene")
      })
    })

    describe("and the position does not match any of the scene's parcels", () => {
      it("should return no results", async () => {
        const response = await supertest(app)
          .get("/api/places")
          .query({ names: "multiparcel.dcl.eth", positions: "99,99" })
          .expect(200)

        expect(response.body.data).toHaveLength(0)
      })
    })
  })

  describe("when a world scene deployment changes the rating of an existing place", () => {
    let job: DeploymentToSqs

    beforeEach(async () => {
      // First deployment with rating "T"
      job = createWorldDeploymentMessage()

      const initialScene = createWorldContentEntityScene({
        worldName: "ratingchange.dcl.eth",
        title: "Rating Change World",
        contentRating: "T",
      })

      mockProcessEntityId.mockResolvedValueOnce(initialScene)
      mockExtractSceneJsonData.mockResolvedValueOnce({
        creator: null,
        runtimeVersion: null,
      })

      await taskRunnerSqs(job)

      // Second deployment with rating "A" (upgrade)
      const upgradedScene = createWorldContentEntityScene({
        worldName: "ratingchange.dcl.eth",
        title: "Rating Change World",
        contentRating: "A",
      })

      mockProcessEntityId.mockResolvedValueOnce(upgradedScene)
      mockExtractSceneJsonData.mockResolvedValueOnce({
        creator: null,
        runtimeVersion: null,
      })

      await taskRunnerSqs(job)
    })

    it("should update the place content rating", async () => {
      const response = await supertest(app)
        .get("/api/places")
        .query({ names: "ratingchange.dcl.eth" })
        .expect(200)

      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].content_rating).toBe("A")
    })
  })
})
