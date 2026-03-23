import supertest from "supertest"

import { DeploymentToSqs } from "../../src/entities/CheckScenes/task/consumer"
import { extractSceneJsonData } from "../../src/entities/CheckScenes/task/extractSceneJsonData"
import { handleWorldUndeployment } from "../../src/entities/CheckScenes/task/handleWorldUndeployment"
import { processEntityId } from "../../src/entities/CheckScenes/task/processEntityId"
import { taskRunnerSqs } from "../../src/entities/CheckScenes/task/taskRunnerSqs"
import { fetchNameOwner } from "../../src/entities/CheckScenes/utils"
import PlaceModel from "../../src/entities/Place/model"
import { DisabledReason } from "../../src/entities/Place/types"
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

// Mock the genesis city manifest update (requires S3) and name owner fetch (requires subgraph)
jest.mock("../../src/entities/CheckScenes/utils", () => ({
  ...jest.requireActual("../../src/entities/CheckScenes/utils"),
  updateGenesisCityManifest: jest.fn(),
  fetchNameOwner: jest.fn().mockResolvedValue(undefined),
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
const mockFetchNameOwner = fetchNameOwner as jest.MockedFunction<
  typeof fetchNameOwner
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

    it("should not overwrite the world record with data from the second deployment", async () => {
      const response = await supertest(app)
        .get("/api/worlds/existingworld.dcl.eth")
        .expect(200)

      expect(response.body.ok).toBe(true)
      expect(response.body.data.world_name).toBe("existingworld.dcl.eth")
      expect(response.body.data.title).toBe("Original Scene")
      expect(response.body.data.description).toBeNull()
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

  async function deployWorldScene(options: {
    worldName: string
    title?: string
    base?: string
    parcels?: string[]
    optOut?: boolean
  }): Promise<void> {
    const job: DeploymentToSqs = createWorldDeploymentMessage()

    const scene = createWorldContentEntityScene({
      worldName: options.worldName,
      title: options.title ?? "Test Scene",
      base: options.base ?? "0,0",
      parcels: options.parcels ?? ["0,0"],
      optOut: options.optOut,
    })

    mockProcessEntityId.mockResolvedValueOnce(scene)
    mockExtractSceneJsonData.mockResolvedValueOnce({
      creator: "0x1234567890abcdef1234567890abcdef12345678",
      runtimeVersion: "7.0.0",
    })

    await taskRunnerSqs(job)
  }

  describe("when a world scene is deployed and then an undeployment event is received", () => {
    let worldName: string

    beforeEach(async () => {
      worldName = "redeployafter-undeploy.dcl.eth"
      await deployWorldScene({ worldName, title: "Original Scene" })

      const event = createWorldUndeploymentEvent(worldName)
      await handleWorldUndeployment(event)
    })

    it("should disable the place with undeployment reason", async () => {
      const place = await PlaceModel.findByWorldIdAndBasePosition(
        worldName,
        "0,0"
      )

      expect(place!.disabled).toBe(true)
      expect(place!.disabled_reason).toBe(DisabledReason.UNDEPLOYMENT)
    })

    describe("and the world scene is redeployed", () => {
      let originalPlaceId: string

      beforeEach(async () => {
        const disabledPlace = await PlaceModel.findByWorldIdAndBasePosition(
          worldName,
          "0,0"
        )
        originalPlaceId = disabledPlace!.id

        await deployWorldScene({ worldName, title: "Redeployed Scene" })
      })

      it("should create a new enabled place with a different id", async () => {
        const response = await supertest(app)
          .get("/api/places")
          .query({ names: worldName })
          .expect(200)

        expect(response.body.data).toHaveLength(1)
        expect(response.body.data[0].title).toBe("Redeployed Scene")
        expect(response.body.data[0].id).not.toBe(originalPlaceId)
      })
    })
  })

  describe("when a world scene is deployed with opt-out", () => {
    let worldName: string

    beforeEach(async () => {
      worldName = "optout-then-optin.dcl.eth"
      await deployWorldScene({
        worldName,
        title: "Opted Out Scene",
        optOut: true,
      })
    })

    it("should disable the place with opt_out reason", async () => {
      const place = await PlaceModel.findByWorldIdAndBasePosition(
        worldName,
        "0,0"
      )

      expect(place!.disabled).toBe(true)
      expect(place!.disabled_reason).toBe(DisabledReason.OPT_OUT)
    })

    describe("and the world scene is redeployed without opt-out", () => {
      let originalPlaceId: string

      beforeEach(async () => {
        const disabledPlace = await PlaceModel.findByWorldIdAndBasePosition(
          worldName,
          "0,0"
        )
        originalPlaceId = disabledPlace!.id

        await deployWorldScene({ worldName, title: "Opted In Scene" })
      })

      it("should re-enable the same place record via the places API", async () => {
        const response = await supertest(app)
          .get("/api/places")
          .query({ names: worldName })
          .expect(200)

        expect(response.body.data).toHaveLength(1)
        expect(response.body.data[0].title).toBe("Opted In Scene")
        expect(response.body.data[0].id).toBe(originalPlaceId)
      })

      it("should clear disabled_at and disabled_reason to null on the place", async () => {
        const place = await PlaceModel.findByWorldIdAndBasePosition(
          worldName,
          "0,0"
        )

        expect(place!.disabled_at).toBeNull()
        expect(place!.disabled_reason).toBeNull()
      })
    })
  })

  describe("when a new world scene is deployed without opt-out", () => {
    let worldName: string

    beforeEach(async () => {
      worldName = "new-nooptout.dcl.eth"
      await deployWorldScene({ worldName, title: "Normal Scene" })
    })

    it("should set the place as enabled with no disabled_reason", async () => {
      const place = await PlaceModel.findByWorldIdAndBasePosition(
        worldName,
        "0,0"
      )

      expect(place!.disabled).toBe(false)
      expect(place!.disabled_reason).toBeNull()
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

  describe("when a world scene is redeployed with different positions (reshaped)", () => {
    let worldName: string
    let originalPlaceId: string

    beforeEach(async () => {
      worldName = "reshaped-world.dcl.eth"

      await deployWorldScene({
        worldName,
        title: "Original Scene",
        base: "0,0",
        parcels: ["0,0", "0,1"],
      })

      const originalPlace = await PlaceModel.findByWorldIdAndBasePosition(
        worldName,
        "0,0"
      )
      originalPlaceId = originalPlace!.id

      // Redeploy with different positions that overlap the original
      await deployWorldScene({
        worldName,
        title: "Reshaped Scene",
        base: "0,1",
        parcels: ["0,1", "0,2"],
      })
    })

    it("should update the existing place preserving its id", async () => {
      const enabledPlaces = await PlaceModel.findEnabledWorldName(worldName)

      expect(enabledPlaces).toHaveLength(1)
      expect(enabledPlaces[0].id).toBe(originalPlaceId)
      expect(enabledPlaces[0].title).toBe("Reshaped Scene")
    })

    it("should update the positions and base_position on the place", async () => {
      const enabledPlaces = await PlaceModel.findEnabledWorldName(worldName)

      expect(enabledPlaces[0].base_position).toBe("0,1")
      expect(enabledPlaces[0].positions).toEqual(["0,1", "0,2"])
    })
  })

  describe("when a world has an existing scene and a new scene is deployed without overlapping positions", () => {
    let worldName: string

    beforeEach(async () => {
      worldName = "no-overlap-world.dcl.eth"

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

    it("should keep both places enabled", async () => {
      const enabledPlaces = await PlaceModel.findEnabledWorldName(worldName)

      expect(enabledPlaces).toHaveLength(2)
      expect(enabledPlaces.map((p) => p.title).sort()).toEqual([
        "Scene A",
        "Scene B",
      ])
    })
  })

  describe("when a world has multiple scenes and a new scene overlaps only one of them", () => {
    let worldName: string
    let sceneAPlaceId: string

    beforeEach(async () => {
      worldName = "partial-overlap-world.dcl.eth"

      await deployWorldScene({
        worldName,
        title: "Scene A",
        base: "0,0",
        parcels: ["0,0", "0,1"],
      })

      const sceneAPlace = await PlaceModel.findByWorldIdAndBasePosition(
        worldName,
        "0,0"
      )
      sceneAPlaceId = sceneAPlace!.id

      await deployWorldScene({
        worldName,
        title: "Scene B",
        base: "5,5",
        parcels: ["5,5"],
      })

      // Scene C overlaps only Scene A (on parcel 0,1)
      await deployWorldScene({
        worldName,
        title: "Scene C",
        base: "0,1",
        parcels: ["0,1", "0,2"],
      })
    })

    it("should update the overlapping scene with the new title", async () => {
      const enabledPlaces = await PlaceModel.findEnabledWorldName(worldName)

      expect(enabledPlaces).toHaveLength(2)
      expect(enabledPlaces.map((p) => p.title).sort()).toEqual([
        "Scene B",
        "Scene C",
      ])
    })

    it("should preserve the original place id of the overlapping scene", async () => {
      const allPlaces = await PlaceModel.findByWorldId(worldName)
      const sceneCPlace = allPlaces.find((p) => p.title === "Scene C")

      expect(sceneCPlace!.id).toBe(sceneAPlaceId)
    })

    it("should keep the non-overlapping scene enabled", async () => {
      const sceneB = await PlaceModel.findByWorldIdAndBasePosition(
        worldName,
        "5,5"
      )

      expect(sceneB!.disabled).toBe(false)
    })
  })

  describe("when a new world scene overlaps multiple existing scenes", () => {
    let worldName: string

    beforeEach(async () => {
      worldName = "multi-overlap-world.dcl.eth"

      await deployWorldScene({
        worldName,
        title: "Scene A",
        base: "0,0",
        parcels: ["0,0", "0,1"],
      })

      await deployWorldScene({
        worldName,
        title: "Scene B",
        base: "0,2",
        parcels: ["0,2", "0,3"],
      })

      // Scene C overlaps both Scene A (on 0,1) and Scene B (on 0,2)
      await deployWorldScene({
        worldName,
        title: "Scene C",
        base: "0,1",
        parcels: ["0,1", "0,2"],
      })
    })

    it("should disable all overlapping scenes with overwritten reason", async () => {
      const sceneA = await PlaceModel.findByWorldIdAndBasePosition(
        worldName,
        "0,0"
      )
      const sceneB = await PlaceModel.findByWorldIdAndBasePosition(
        worldName,
        "0,2"
      )

      expect(sceneA!.disabled).toBe(true)
      expect(sceneA!.disabled_reason).toBe(DisabledReason.OVERWRITTEN)
      expect(sceneB!.disabled).toBe(true)
      expect(sceneB!.disabled_reason).toBe(DisabledReason.OVERWRITTEN)
    })

    it("should create the new scene as enabled", async () => {
      const enabledPlaces = await PlaceModel.findEnabledWorldName(worldName)

      expect(enabledPlaces).toHaveLength(1)
      expect(enabledPlaces[0].title).toBe("Scene C")
    })
  })

  describe("when a newer world scene deployment already exists for overlapping positions", () => {
    let worldName: string

    beforeEach(async () => {
      worldName = "stale-deploy-world.dcl.eth"

      // Deploy a scene with a recent timestamp
      await deployWorldScene({
        worldName,
        title: "Newer Scene",
        base: "0,0",
        parcels: ["0,0"],
      })
    })

    it("should skip the stale deployment and keep the newer place", async () => {
      const job: DeploymentToSqs = createWorldDeploymentMessage()

      const staleScene = createWorldContentEntityScene({
        worldName,
        title: "Stale Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      // Override the timestamp to be clearly older than the existing scene.
      // Use a large offset (1 day) to account for timezone differences between
      // Date.now() and the DB's timestamptz storage/retrieval.
      staleScene.timestamp = Date.now() - 86_400_000

      mockProcessEntityId.mockResolvedValueOnce(staleScene)
      mockExtractSceneJsonData.mockResolvedValueOnce({
        creator: "0x1234567890abcdef1234567890abcdef12345678",
        runtimeVersion: "7.0.0",
      })

      await taskRunnerSqs(job)

      const enabledPlaces = await PlaceModel.findEnabledWorldName(worldName)

      expect(enabledPlaces).toHaveLength(1)
      expect(enabledPlaces[0].title).toBe("Newer Scene")
    })
  })

  describe("when a world scene is deployed to positions previously held by an overwritten place", () => {
    let worldName: string

    beforeEach(async () => {
      worldName = "redeploy-after-overwrite.dcl.eth"

      // Deploy Scene A
      await deployWorldScene({
        worldName,
        title: "Scene A",
        base: "0,0",
        parcels: ["0,0", "0,1"],
      })

      // Deploy Scene B overlapping Scene A on both parcels → 1 overlap → updates A
      await deployWorldScene({
        worldName,
        title: "Scene B",
        base: "0,1",
        parcels: ["0,1", "0,2"],
      })

      // Deploy Scene C overlapping the updated place on 0,2 + a new parcel
      // that also overlaps nothing else → 1 overlap → updates again
      await deployWorldScene({
        worldName,
        title: "Scene C",
        base: "0,2",
        parcels: ["0,2", "0,3"],
      })

      // Now the single active place has positions [0,2, 0,3].
      // Deploy a scene at the original positions [0,0] which no active place holds
      await deployWorldScene({
        worldName,
        title: "Scene D",
        base: "0,0",
        parcels: ["0,0"],
      })
    })

    it("should create a new place at the previously abandoned positions", async () => {
      const enabledPlaces = await PlaceModel.findEnabledWorldName(worldName)

      expect(enabledPlaces).toHaveLength(2)
      expect(enabledPlaces.map((p) => p.title).sort()).toEqual([
        "Scene C",
        "Scene D",
      ])
    })
  })

  describe("when the name owner differs from the metadata owner", () => {
    describe("and both are present", () => {
      beforeEach(async () => {
        const scene = createWorldContentEntityScene({
          worldName: "ownertest.dcl.eth",
          title: "Owner Test Scene",
        })
        // scene fixture has metadata.owner = 0x1234...

        mockFetchNameOwner.mockResolvedValueOnce(
          "0xnameowner00000000000000000000000000000000"
        )

        mockProcessEntityId.mockResolvedValueOnce(scene)
        mockExtractSceneJsonData.mockResolvedValueOnce({
          creator: null,
          runtimeVersion: null,
        })

        const job = createWorldDeploymentMessage()
        await taskRunnerSqs(job)
      })

      it("should set the world owner to the name owner", async () => {
        const response = await supertest(app)
          .get("/api/worlds/ownertest.dcl.eth")
          .expect(200)

        expect(response.body.ok).toBe(true)
        expect(response.body.data.owner).toBe(
          "0xnameowner00000000000000000000000000000000"
        )
      })

      it("should set the place owner to the metadata owner", async () => {
        const response = await supertest(app)
          .get("/api/places")
          .query({ names: "ownertest.dcl.eth" })
          .expect(200)

        expect(response.body.data).toHaveLength(1)
        expect(response.body.data[0].owner).toBe(
          "0x1234567890abcdef1234567890abcdef12345678"
        )
      })
    })
  })

  describe("when the world owner changes between deployments", () => {
    beforeEach(async () => {
      const firstScene = createWorldContentEntityScene({
        worldName: "ownerchange.dcl.eth",
        title: "First Deploy",
      })

      mockFetchNameOwner.mockResolvedValueOnce(
        "0xoriginalowner0000000000000000000000000000"
      )

      mockProcessEntityId.mockResolvedValueOnce(firstScene)
      mockExtractSceneJsonData.mockResolvedValueOnce({
        creator: null,
        runtimeVersion: null,
      })

      const job = createWorldDeploymentMessage()
      await taskRunnerSqs(job)

      // Second deployment with a new name owner (name was transferred)
      const secondScene = createWorldContentEntityScene({
        worldName: "ownerchange.dcl.eth",
        title: "Second Deploy",
      })

      mockFetchNameOwner.mockResolvedValueOnce(
        "0xnewowner000000000000000000000000000000000"
      )

      mockProcessEntityId.mockResolvedValueOnce(secondScene)
      mockExtractSceneJsonData.mockResolvedValueOnce({
        creator: null,
        runtimeVersion: null,
      })

      await taskRunnerSqs(job)
    })

    it("should update the world owner to the new name owner", async () => {
      const response = await supertest(app)
        .get("/api/worlds/ownerchange.dcl.eth")
        .expect(200)

      expect(response.body.ok).toBe(true)
      expect(response.body.data.owner).toBe(
        "0xnewowner000000000000000000000000000000000"
      )
    })
  })

  describe("when a world scene deployment is received without an owner in the metadata", () => {
    describe("and fetchNameOwner returns the owner", () => {
      beforeEach(async () => {
        const scene = createWorldContentEntityScene({
          worldName: "noowner.dcl.eth",
          title: "No Owner Scene",
        })
        // Remove owner from the scene metadata to trigger the fallback
        delete (scene.metadata as Record<string, unknown>).owner

        mockFetchNameOwner.mockResolvedValueOnce(
          "0xfallbackowner000000000000000000000000000"
        )

        mockProcessEntityId.mockResolvedValueOnce(scene)
        mockExtractSceneJsonData.mockResolvedValueOnce({
          creator: null,
          runtimeVersion: null,
        })

        const job = createWorldDeploymentMessage()
        await taskRunnerSqs(job)
      })

      it("should set the world owner to the name owner", async () => {
        const response = await supertest(app)
          .get("/api/worlds/noowner.dcl.eth")
          .expect(200)

        expect(response.body.ok).toBe(true)
        expect(response.body.data.owner).toBe(
          "0xfallbackowner000000000000000000000000000"
        )
      })

      it("should use the name owner as fallback for the place owner", async () => {
        const response = await supertest(app)
          .get("/api/places")
          .query({ names: "noowner.dcl.eth" })
          .expect(200)

        expect(response.body.data).toHaveLength(1)
        expect(response.body.data[0].owner).toBe(
          "0xfallbackowner000000000000000000000000000"
        )
      })
    })

    describe("and fetchNameOwner returns undefined", () => {
      beforeEach(async () => {
        const scene = createWorldContentEntityScene({
          worldName: "noowner-nofallback.dcl.eth",
          title: "No Owner No Fallback",
        })
        delete (scene.metadata as Record<string, unknown>).owner

        mockFetchNameOwner.mockResolvedValueOnce(undefined)

        mockProcessEntityId.mockResolvedValueOnce(scene)
        mockExtractSceneJsonData.mockResolvedValueOnce({
          creator: null,
          runtimeVersion: null,
        })

        const job = createWorldDeploymentMessage()
        await taskRunnerSqs(job)
      })

      it("should create the world with a null owner", async () => {
        const response = await supertest(app)
          .get("/api/worlds/noowner-nofallback.dcl.eth")
          .expect(200)

        expect(response.body.ok).toBe(true)
        expect(response.body.data.owner).toBeNull()
      })
    })
  })
})
