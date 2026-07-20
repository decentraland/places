import { randomUUID } from "crypto"

import database from "decentraland-gatsby/dist/entities/Database/database"
import supertest from "supertest"

import { DeploymentToSqs } from "../../src/entities/CheckScenes/task/consumer"
import { extractSceneJsonData } from "../../src/entities/CheckScenes/task/extractSceneJsonData"
import { handleWorldUndeployment } from "../../src/entities/CheckScenes/task/handleWorldUndeployment"
import { createPlaceFromContentEntityScene } from "../../src/entities/CheckScenes/task/processContentEntityScene"
import { processEntityId } from "../../src/entities/CheckScenes/task/processEntityId"
import {
  placesAttributes,
  taskRunnerSqs,
} from "../../src/entities/CheckScenes/task/taskRunnerSqs"
import { fetchNameOwner } from "../../src/entities/CheckScenes/utils"
import PlaceModel from "../../src/entities/Place/model"
import { DisabledReason } from "../../src/entities/Place/types"
import WorldModel from "../../src/entities/World/model"
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

    it("should create the world with show_in_places set to true", async () => {
      const world = await WorldModel.findByWorldName(worldName)

      expect(world).not.toBeNull()
      expect(world!.show_in_places).toBe(true)
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

  describe("when a new world scene overlaps multiple existing scenes and shares one of their base parcels", () => {
    let worldName: string
    let sceneAPlaceId: string
    let sceneBPlaceId: string

    beforeEach(async () => {
      worldName = "multi-overlap-samebase-world.dcl.eth"

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

      sceneAPlaceId = (await PlaceModel.findByWorldIdAndBasePosition(
        worldName,
        "0,0"
      ))!.id
      sceneBPlaceId = (await PlaceModel.findByWorldIdAndBasePosition(
        worldName,
        "0,2"
      ))!.id

      // Scene C overlaps both A (on 0,1) and B (on 0,2) but keeps Scene A's base (0,0)
      await deployWorldScene({
        worldName,
        title: "Scene C",
        base: "0,0",
        parcels: ["0,0", "0,1", "0,2"],
      })
    })

    it("should reuse the shared-base place id instead of creating a new one", async () => {
      const enabledPlaces = await PlaceModel.findEnabledWorldName(worldName)

      expect(enabledPlaces).toHaveLength(1)
      expect(enabledPlaces[0].id).toBe(sceneAPlaceId)
      expect(enabledPlaces[0].title).toBe("Scene C")
    })

    it("should update the reused place with the redeployed positions", async () => {
      const enabledPlaces = await PlaceModel.findEnabledWorldName(worldName)

      expect(enabledPlaces[0].base_position).toBe("0,0")
      expect(enabledPlaces[0].positions.sort()).toEqual(["0,0", "0,1", "0,2"])
    })

    it("should disable only the other overlapping scene", async () => {
      const sceneB = await PlaceModel.findByWorldIdAndBasePosition(
        worldName,
        "0,2"
      )

      expect(sceneB!.id).toBe(sceneBPlaceId)
      expect(sceneB!.disabled).toBe(true)
      expect(sceneB!.disabled_reason).toBe(DisabledReason.OVERWRITTEN)
    })
  })

  describe("the active world scene uniqueness guard", () => {
    describe("and an enabled world scene already exists", () => {
      const worldName = "uniqueness-guard-enabled.dcl.eth"

      beforeEach(async () => {
        await deployWorldScene({
          worldName,
          title: "Only Scene",
          base: "0,0",
          parcels: ["0,0"],
        })
      })

      it("should reject a second enabled place for the same world scene", async () => {
        const existing = await PlaceModel.findByWorldIdAndBasePosition(
          worldName,
          "0,0"
        )
        const duplicate = {
          ...existing!,
          id: randomUUID(),
          created_at: new Date(),
          updated_at: new Date(),
        }

        await expect(
          PlaceModel.insertPlace(duplicate, placesAttributes)
        ).rejects.toThrow()
      })

      it("should allow a new place once the original is disabled as overwritten", async () => {
        const existing = await PlaceModel.findByWorldIdAndBasePosition(
          worldName,
          "0,0"
        )
        // overwritten/undeployment/moderation are not active identities, so the slot frees up
        await PlaceModel.disablePlaces([existing!.id])

        const replacement = {
          ...existing!,
          id: randomUUID(),
          disabled: false,
          disabled_at: null,
          disabled_reason: null,
          created_at: new Date(),
          updated_at: new Date(),
        }

        await expect(
          PlaceModel.insertPlace(replacement, placesAttributes)
        ).resolves.not.toThrow()
      })
    })

    describe("and an opted-out world scene already exists", () => {
      const worldName = "uniqueness-guard-optout.dcl.eth"

      beforeEach(async () => {
        await deployWorldScene({
          worldName,
          title: "Opted Out",
          base: "0,0",
          parcels: ["0,0"],
          optOut: true,
        })
      })

      it("should reject a second opted-out place for the same world scene", async () => {
        const existing = await PlaceModel.findByWorldIdAndBasePosition(
          worldName,
          "0,0"
        )
        // opt_out rows are active identities too, so a duplicate must still be rejected
        const duplicate = {
          ...existing!,
          id: randomUUID(),
          created_at: new Date(),
          updated_at: new Date(),
        }

        await expect(
          PlaceModel.insertPlace(duplicate, placesAttributes)
        ).rejects.toThrow()
      })

      it("should reject an enabled place while an opted-out identity exists", async () => {
        const existing = await PlaceModel.findByWorldIdAndBasePosition(
          worldName,
          "0,0"
        )
        const enabledDuplicate = {
          ...existing!,
          id: randomUUID(),
          disabled: false,
          disabled_at: null,
          disabled_reason: null,
          created_at: new Date(),
          updated_at: new Date(),
        }

        await expect(
          PlaceModel.insertPlace(enabledDuplicate, placesAttributes)
        ).rejects.toThrow()
      })
    })
  })

  describe("the active world place dedup step of the uniqueness migration", () => {
    const UNIQUE_INDEX = "places_active_world_scene_uniq"

    // Verbatim copy of the dedup step in
    // src/migrations/1784295151000_guard-active-world-place-uniqueness.ts.
    // That migration is immutable, so this snapshot cannot drift out from under it.
    const DEDUP_SQL = `
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY world_id, base_position
                 ORDER BY (disabled IS FALSE) DESC, like_score DESC NULLS LAST, deployed_at DESC, id DESC
               ) AS rn
        FROM places
        WHERE world IS TRUE
          AND world_id IS NOT NULL
          AND base_position IS NOT NULL
          AND (disabled IS FALSE OR disabled_reason = 'opt_out')
      )
      UPDATE places p
      SET "disabled" = TRUE,
          "disabled_at" = now(),
          "updated_at" = now(),
          "disabled_reason" = 'overwritten'
      FROM ranked r
      WHERE p.id = r.id
        AND r.rn > 1
    `

    const RECREATE_INDEX_SQL = `
      CREATE UNIQUE INDEX IF NOT EXISTS "${UNIQUE_INDEX}" ON places ("world_id", "base_position")
      WHERE world IS TRUE AND world_id IS NOT NULL AND base_position IS NOT NULL
        AND (disabled IS FALSE OR disabled_reason = 'opt_out')
    `

    // Reintroduce the pre-migration duplicate-identity state (which the index now forbids)
    // by inserting rows directly, then feed them to the dedup step. Rows are inserted through
    // the same path so their relative deployed_at order survives the naive timestamp column.
    const seedIdentityRows = async (
      worldName: string,
      rows: Array<{
        title: string
        deployedAt: Date
        likeScore?: number
        optOut?: boolean
      }>
    ): Promise<string[]> => {
      const scene = createWorldContentEntityScene({
        worldName,
        base: "0,0",
        parcels: ["0,0"],
      })
      const worldId = await WorldModel.insertWorldIfNotExists({
        world_name: worldName,
      })

      const ids: string[] = []
      for (const row of rows) {
        const place = {
          ...createPlaceFromContentEntityScene(scene, {}, { worldId }),
          id: randomUUID(),
          title: row.title,
          deployed_at: row.deployedAt,
          disabled: row.optOut ?? false,
          disabled_reason: row.optOut ? DisabledReason.OPT_OUT : null,
          disabled_at: row.optOut ? new Date() : null,
        }
        await PlaceModel.insertPlace(place, placesAttributes)
        // like_score is not part of placesAttributes, so set it explicitly when needed.
        if (row.likeScore !== undefined) {
          await database.query(
            `UPDATE places SET like_score = ${row.likeScore} WHERE id = '${place.id}'`
          )
        }
        ids.push(place.id)
      }
      return ids
    }

    beforeEach(async () => {
      await database.query(`DROP INDEX IF EXISTS "${UNIQUE_INDEX}"`)
    })

    afterEach(async () => {
      // Restore the index for the rest of the suite (dedup leaves a single identity
      // row per scene, so the unique index can be recreated).
      await database.query(RECREATE_INDEX_SQL)
    })

    describe("and several enabled duplicates exist", () => {
      const worldName = "dedup-enabled.dcl.eth"
      const baseMs = 1_700_000_000_000
      let newestId: string
      let olderIds: string[]

      beforeEach(async () => {
        const [olderId, middleId, newestPlaceId] = await seedIdentityRows(
          worldName,
          [
            { title: "Older", deployedAt: new Date(baseMs) },
            { title: "Middle", deployedAt: new Date(baseMs + 3_600_000) },
            { title: "Newest", deployedAt: new Date(baseMs + 7_200_000) },
          ]
        )
        newestId = newestPlaceId
        olderIds = [olderId, middleId]

        await database.query(DEDUP_SQL)
      })

      it("should keep exactly one identity, the most recently deployed", async () => {
        const active = (await PlaceModel.findByWorldId(worldName)).filter(
          (place) => !place.disabled
        )

        expect(active).toHaveLength(1)
        expect(active[0].id).toBe(newestId)
      })

      it("should disable the older duplicates with the overwritten reason", async () => {
        const disabled = (await PlaceModel.findByWorldId(worldName)).filter(
          (place) => place.disabled
        )

        expect(disabled.map((place) => place.id).sort()).toEqual(
          [...olderIds].sort()
        )
        expect(
          disabled.every(
            (place) => place.disabled_reason === DisabledReason.OVERWRITTEN
          )
        ).toBe(true)
      })
    })

    describe("and an older duplicate has more engagement than a newer one", () => {
      const worldName = "dedup-engagement.dcl.eth"
      const baseMs = 1_700_000_000_000
      let engagedId: string

      beforeEach(async () => {
        const [olderEngagedId] = await seedIdentityRows(worldName, [
          {
            title: "Older but liked",
            deployedAt: new Date(baseMs),
            likeScore: 0.9,
          },
          {
            title: "Newer but ignored",
            deployedAt: new Date(baseMs + 7_200_000),
            likeScore: 0.1,
          },
        ])
        engagedId = olderEngagedId

        await database.query(DEDUP_SQL)
      })

      it("should keep the higher-engagement place, not merely the newest", async () => {
        const active = (await PlaceModel.findByWorldId(worldName)).filter(
          (place) => !place.disabled
        )

        expect(active).toHaveLength(1)
        expect(active[0].id).toBe(engagedId)
      })
    })

    describe("and an enabled duplicate coexists with an opted-out one", () => {
      const worldName = "dedup-optout.dcl.eth"
      const baseMs = 1_700_000_000_000
      let enabledId: string
      let optOutId: string

      beforeEach(async () => {
        const [optOutPlaceId, enabledPlaceId] = await seedIdentityRows(
          worldName,
          [
            {
              title: "Opted out",
              deployedAt: new Date(baseMs + 7_200_000),
              optOut: true,
            },
            { title: "Enabled", deployedAt: new Date(baseMs) },
          ]
        )
        optOutId = optOutPlaceId
        enabledId = enabledPlaceId

        await database.query(DEDUP_SQL)
      })

      it("should keep the enabled place as the identity", async () => {
        const active = (await PlaceModel.findByWorldId(worldName)).filter(
          (place) => !place.disabled
        )

        expect(active).toHaveLength(1)
        expect(active[0].id).toBe(enabledId)
      })

      it("should disable the opted-out duplicate as overwritten", async () => {
        const optOut = (await PlaceModel.findByWorldId(worldName)).find(
          (place) => place.id === optOutId
        )

        expect(optOut!.disabled).toBe(true)
        expect(optOut!.disabled_reason).toBe(DisabledReason.OVERWRITTEN)
      })
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
          "0xnameowner0000000000000000000000000000000"
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
          "0xnameowner0000000000000000000000000000000"
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
        "0xoriginalowner000000000000000000000000000"
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
        "0xnewowner00000000000000000000000000000000"
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
        "0xnewowner00000000000000000000000000000000"
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

  describe("when extractSceneJsonData fails to read scene.json", () => {
    describe("and the entity metadata still carries creator and runtimeVersion", () => {
      beforeEach(async () => {
        const scene = createWorldContentEntityScene({
          worldName: "fallback-meta.dcl.eth",
          title: "Fallback From Metadata",
        })
        Object.assign(scene.metadata, {
          creator: "0xcreatorfrommetadata000000000000000000000",
          runtimeVersion: "7",
        })

        mockProcessEntityId.mockResolvedValueOnce(scene)
        mockExtractSceneJsonData.mockResolvedValueOnce({
          creator: null,
          runtimeVersion: null,
        })

        const job = createWorldDeploymentMessage()
        await taskRunnerSqs(job)
      })

      it("should populate creator_address and sdk from entity metadata", async () => {
        const response = await supertest(app)
          .get("/api/places")
          .query({ names: "fallback-meta.dcl.eth" })
          .expect(200)

        expect(response.body.data).toHaveLength(1)
        expect(response.body.data[0].creator_address).toBe(
          "0xcreatorfrommetadata000000000000000000000"
        )
        expect(response.body.data[0].sdk).toBe("7")
      })
    })

    describe("and the entity metadata does not carry creator or runtimeVersion", () => {
      beforeEach(async () => {
        const scene = createWorldContentEntityScene({
          worldName: "no-fallback-meta.dcl.eth",
          title: "No Fallback Available",
        })

        mockProcessEntityId.mockResolvedValueOnce(scene)
        mockExtractSceneJsonData.mockResolvedValueOnce({
          creator: null,
          runtimeVersion: null,
        })

        const job = createWorldDeploymentMessage()
        await taskRunnerSqs(job)
      })

      it("should leave creator_address and sdk null", async () => {
        const response = await supertest(app)
          .get("/api/places")
          .query({ names: "no-fallback-meta.dcl.eth" })
          .expect(200)

        expect(response.body.data).toHaveLength(1)
        expect(response.body.data[0].creator_address).toBeNull()
        expect(response.body.data[0].sdk).toBeNull()
      })
    })
  })
})
