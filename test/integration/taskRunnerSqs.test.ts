import supertest from "supertest"

import CategoryModel from "../../src/entities/Category/model"
import CheckScenesModel from "../../src/entities/CheckScenes/model"
import { InvalidWorldSqsMessageError } from "../../src/entities/CheckScenes/task/errors"
import { extractSceneJsonData } from "../../src/entities/CheckScenes/task/extractSceneJsonData"
import {
  fetchWorldActiveScenes,
  fetchWorldActiveScenesAtPositions,
} from "../../src/entities/CheckScenes/task/fetchWorldActiveScenes"
import { handleWorldUndeployment } from "../../src/entities/CheckScenes/task/handleWorldUndeployment"
import { processEntityId } from "../../src/entities/CheckScenes/task/processEntityId"
import { taskRunnerSqs } from "../../src/entities/CheckScenes/task/taskRunnerSqs"
import {
  CheckSceneLogs,
  CheckSceneLogsTypes,
} from "../../src/entities/CheckScenes/types"
import { fetchNameOwner } from "../../src/entities/CheckScenes/utils"
import PlaceModel from "../../src/entities/Place/model"
import { DisabledReason, PlaceAttributes } from "../../src/entities/Place/types"
import PlaceCategories from "../../src/entities/PlaceCategories/model"
import PlaceContentRatingModel from "../../src/entities/PlaceContentRating/model"
import { PlaceContentRatingAttributes } from "../../src/entities/PlaceContentRating/types"
import PlacePositionModel from "../../src/entities/PlacePosition/model"
import { PlacePositionAttributes } from "../../src/entities/PlacePosition/types"
import { notifyUpdatePlace } from "../../src/entities/Slack/utils"
import WorldModel from "../../src/entities/World/model"
import WorldDeploymentPositionWatermarkModel from "../../src/entities/WorldDeploymentPositionWatermark/model"
import WorldSceneUndeploymentModel from "../../src/entities/WorldSceneUndeployment/model"
import {
  createWorldContentEntityScene,
  createWorldDeploymentMessage,
} from "../fixtures/deploymentEvent"
import { createWorldUndeploymentEvent } from "../fixtures/undeploymentEvent"
import { cleanTables, closeTestDb, initTestDb } from "../setup/db"
import { createTestApp } from "../setup/server"

import type { DeploymentToSqs } from "../../src/entities/CheckScenes/task/consumer"
import type { ContentEntityScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

// Mock external HTTP calls
jest.mock("../../src/entities/CheckScenes/task/processEntityId")
jest.mock("../../src/entities/CheckScenes/task/extractSceneJsonData")
// Undeployment handlers ask the content server what the world still serves. These suites drive the
// removal of every scene they created, so the default is a world that serves nothing.
jest.mock("../../src/entities/CheckScenes/task/fetchWorldActiveScenes", () => ({
  fetchWorldActiveScenes: jest.fn(async () => ({
    deploymentIds: [],
    positions: [],
  })),
  fetchWorldActiveScenesAtPositions: jest.fn(async () => ({
    deploymentIds: [],
    positions: [],
  })),
}))

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

const notifyUpdatePlaceMock = notifyUpdatePlace as jest.MockedFunction<
  typeof notifyUpdatePlace
>

// Distinct deployment revisions used to tell which one a place ended up holding
const OLDER_ENTITY_ID =
  "bafkreigmbmwtfptb7uocny5fpnnxl2vvbzxxzbdkzpmneqgbjw2if62f2e"
const NEWER_ENTITY_ID =
  "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku"
const NEIGHBOUR_ENTITY_ID =
  "bafkreidxb345bwbdtiuyghqn5dizgxcavwnvgcyw5rzegfn2gp2rgv334e"

function deploymentMessageWithEntityId(entityId: string): DeploymentToSqs {
  const message = createWorldDeploymentMessage()
  return { ...message, entity: { ...message.entity, entityId } }
}

/** Same scene fixture without worldConfiguration, so it is ingested as a Genesis City place. */
function createGenesisContentEntityScene(options: {
  title: string
  base: string
  parcels: string[]
}): ContentEntityScene {
  const scene = createWorldContentEntityScene(options)
  delete (scene.metadata as { worldConfiguration?: unknown }).worldConfiguration
  return scene
}

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
    // resetAllMocks clears the implementation the module factory gave these, so restore the default
    // of a world that serves nothing
    jest.mocked(fetchWorldActiveScenes).mockResolvedValue({
      deploymentIds: [],
      positions: [],
      oldestDeployedAt: null,
    })
    jest.mocked(fetchWorldActiveScenesAtPositions).mockResolvedValue({
      deploymentIds: [],
      positions: [],
      oldestDeployedAt: null,
    })
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

  describe("when persisting a new world place fails", () => {
    let insertPlaceSpy: jest.SpyInstance
    let taskError: Error | null
    let world: Awaited<ReturnType<typeof WorldModel.findByWorldName>>

    beforeEach(async () => {
      const job = createWorldDeploymentMessage()
      const contentEntityScene = createWorldContentEntityScene({
        worldName: "rollback-world.dcl.eth",
        title: "Rollback World",
      })

      mockProcessEntityId.mockResolvedValueOnce(contentEntityScene)
      mockExtractSceneJsonData.mockResolvedValueOnce({
        creator: null,
        runtimeVersion: null,
      })
      insertPlaceSpy = jest
        .spyOn(PlaceModel, "insertPlace")
        .mockRejectedValueOnce(new Error("place persistence failed"))

      taskError = null
      try {
        await taskRunnerSqs(job)
      } catch (error: unknown) {
        taskError = error as Error
      }
      world = await WorldModel.findByWorldName("rollback-world.dcl.eth")
    })

    afterEach(() => {
      insertPlaceSpy.mockRestore()
    })

    it("should surface the persistence failure", () => {
      expect(taskError).toEqual(new Error("place persistence failed"))
    })

    it("should roll back the world created in the same transaction", () => {
      expect(world).toBeNull()
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
    entityId?: string
    timestamp?: number
  }): Promise<void> {
    const job: DeploymentToSqs = createWorldDeploymentMessage(
      options.entityId
        ? {
            entity: {
              ...createWorldDeploymentMessage().entity,
              entityId: options.entityId,
            },
          }
        : {}
    )

    const scene = createWorldContentEntityScene({
      worldName: options.worldName,
      title: options.title ?? "Test Scene",
      base: options.base ?? "0,0",
      parcels: options.parcels ?? ["0,0"],
      optOut: options.optOut,
    })

    if (options.timestamp !== undefined) {
      scene.timestamp = options.timestamp
    }

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

  describe("when a deployment declares a scene base outside its authorized pointers", () => {
    let worldName: string
    let thrownError: unknown

    beforeEach(async () => {
      worldName = "forged-base.dcl.eth"

      const scene = createWorldContentEntityScene({
        worldName,
        title: "Forged Identity",
        base: "100,100",
        parcels: ["0,0"],
      })

      mockProcessEntityId.mockResolvedValueOnce(scene)
      mockExtractSceneJsonData.mockResolvedValueOnce({
        creator: null,
        runtimeVersion: null,
      })

      thrownError = await taskRunnerSqs(createWorldDeploymentMessage()).then(
        () => null,
        (error: unknown) => error
      )
    })

    it("should reject the deployment as a deterministically invalid message", () => {
      expect(thrownError).toBeInstanceOf(InvalidWorldSqsMessageError)
    })

    it("should not create a place for the forged scene identity", async () => {
      expect(await PlaceModel.findEnabledWorldName(worldName)).toHaveLength(0)
    })
  })

  describe("when an older deployment is applied after a newer revision was already stored", () => {
    let worldName: string
    let findActiveByWorldIdAndPositions: jest.SpyInstance
    let olderTimestamp: number
    let storedPlaceId: string

    beforeEach(async () => {
      worldName = "revision-race-world.dcl.eth"
      olderTimestamp = Date.now() - 86_400_000

      await deployWorldScene({
        worldName,
        title: "Newer Scene",
        entityId: NEWER_ENTITY_ID,
      })

      const [storedPlace] = await PlaceModel.findEnabledWorldName(worldName)
      storedPlaceId = storedPlace.id

      // Hand the older deployment the snapshot it would have read before the newer revision
      // committed, so its in-memory stale check passes and only the write guard can stop it.
      findActiveByWorldIdAndPositions = jest
        .spyOn(PlaceModel, "findActiveByWorldIdAndPositions")
        .mockResolvedValueOnce([
          {
            ...storedPlace,
            deployment_id: null,
            deployed_at: new Date(olderTimestamp - 1000),
          },
        ])

      // A different rating so the discarded update would otherwise log a rating change
      const scene = createWorldContentEntityScene({
        worldName,
        title: "Older Scene",
        contentRating: "T",
      })
      scene.timestamp = olderTimestamp

      mockProcessEntityId.mockResolvedValueOnce(scene)
      mockExtractSceneJsonData.mockResolvedValueOnce({
        creator: "0x1234567890abcdef1234567890abcdef12345678",
        runtimeVersion: "7.0.0",
      })

      await taskRunnerSqs(deploymentMessageWithEntityId(OLDER_ENTITY_ID))
    })

    afterEach(() => {
      findActiveByWorldIdAndPositions.mockRestore()
    })

    it("should keep the newer revision metadata on the place", async () => {
      const [place] = await PlaceModel.findEnabledWorldName(worldName)

      expect(place.title).toBe("Newer Scene")
    })

    it("should keep the newer deployment id on the place", async () => {
      const [place] = await PlaceModel.findEnabledWorldName(worldName)

      expect(place.deployment_id).toBe(NEWER_ENTITY_ID)
    })

    it("should not notify the discarded update", () => {
      expect(notifyUpdatePlaceMock).not.toHaveBeenCalled()
    })

    it("should log the discarded deployment as avoided", async () => {
      const logs = await CheckScenesModel.find<CheckSceneLogs>({
        entity_id: OLDER_ENTITY_ID,
      })

      expect(logs.map((log) => log.action)).toEqual([CheckSceneLogsTypes.AVOID])
    })

    it("should not record a content rating change for the discarded update", async () => {
      const ratings =
        await PlaceContentRatingModel.find<PlaceContentRatingAttributes>({
          entity_id: storedPlaceId,
        })

      expect(ratings.map((rating) => rating.update_rating)).toEqual(["RP"])
    })
  })

  describe("when two workers deploy revisions of the same world scene concurrently", () => {
    let worldName: string

    beforeEach(async () => {
      worldName = "concurrent-world.dcl.eth"

      const olderScene = createWorldContentEntityScene({
        worldName,
        title: "Older Scene",
      })
      olderScene.timestamp = Date.now() - 86_400_000

      const newerScene = createWorldContentEntityScene({
        worldName,
        title: "Newer Scene",
      })

      mockProcessEntityId
        .mockResolvedValueOnce(olderScene)
        .mockResolvedValueOnce(newerScene)
      mockExtractSceneJsonData.mockResolvedValue({
        creator: "0x1234567890abcdef1234567890abcdef12345678",
        runtimeVersion: "7.0.0",
      })

      await Promise.all([
        taskRunnerSqs(deploymentMessageWithEntityId(OLDER_ENTITY_ID)),
        taskRunnerSqs(deploymentMessageWithEntityId(NEWER_ENTITY_ID)),
      ])
    })

    it("should keep a single active place for the world scene", async () => {
      expect(await PlaceModel.findEnabledWorldName(worldName)).toHaveLength(1)
    })

    it("should leave the newest revision stored on it", async () => {
      const [place] = await PlaceModel.findEnabledWorldName(worldName)

      expect(place.deployment_id).toBe(NEWER_ENTITY_ID)
    })
  })

  describe("when a Genesis City place is successfully updated with a reshaped footprint", () => {
    let enabledPlaces: PlaceAttributes[]
    let enabledPlace: PlaceAttributes
    let logs: CheckSceneLogs[]
    let originalScene: ContentEntityScene
    let positionRows: PlacePositionAttributes[]
    let updatedScene: ContentEntityScene
    let updateLogActions: CheckSceneLogsTypes[]

    beforeEach(async () => {
      originalScene = createGenesisContentEntityScene({
        title: "Original Genesis Shape",
        base: "30,30",
        parcels: ["30,30", "30,31"],
      })
      mockProcessEntityId.mockResolvedValueOnce(originalScene)
      mockExtractSceneJsonData.mockResolvedValueOnce({
        creator: null,
        runtimeVersion: null,
      })
      await taskRunnerSqs(deploymentMessageWithEntityId(OLDER_ENTITY_ID))

      updatedScene = createGenesisContentEntityScene({
        title: "Updated Genesis Shape",
        base: "30,30",
        parcels: ["30,30", "30,32"],
      })
      updatedScene.timestamp = originalScene.timestamp + 1_000
      mockProcessEntityId.mockResolvedValueOnce(updatedScene)
      mockExtractSceneJsonData.mockResolvedValueOnce({
        creator: null,
        runtimeVersion: null,
      })
      await taskRunnerSqs(deploymentMessageWithEntityId(NEWER_ENTITY_ID))

      enabledPlaces = await PlaceModel.findEnabledByPositions(["30,30"])
      enabledPlace = enabledPlaces[0]
      positionRows = await PlacePositionModel.find<PlacePositionAttributes>({
        base_position: "30,30",
      })
      logs = await CheckScenesModel.find<CheckSceneLogs>({
        entity_id: NEWER_ENTITY_ID,
      })
      updateLogActions = logs.map((log) => log.action)
    })

    it("should update the existing place metadata", () => {
      expect(enabledPlace.title).toBe("Updated Genesis Shape")
    })

    it("should replace the removed position with the new position mapping", () => {
      expect(positionRows.map((row) => row.position).sort()).toEqual([
        "30,30",
        "30,32",
      ])
    })

    it("should record the successful update action", () => {
      expect(updateLogActions).toEqual([CheckSceneLogsTypes.UPDATE])
    })
  })

  describe("when a tagged Genesis City deployment is accepted", () => {
    let categoryRows: Array<{ category_id: string }>
    let logs: CheckSceneLogs[]
    let now: Date
    let placeCategories: string[]
    let placeCategoryRows: string[]
    let places: PlaceAttributes[]
    let scene: ContentEntityScene
    let newLogActions: CheckSceneLogsTypes[]

    beforeEach(async () => {
      now = new Date()
      await CategoryModel.createOne({
        name: "art",
        active: true,
        created_at: now,
        updated_at: now,
      })

      scene = createGenesisContentEntityScene({
        title: "Tagged Genesis Scene",
        base: "40,40",
        parcels: ["40,40"],
      })
      scene.metadata.tags = ["art"]
      mockProcessEntityId.mockResolvedValueOnce(scene)
      mockExtractSceneJsonData.mockResolvedValueOnce({
        creator: null,
        runtimeVersion: null,
      })
      await taskRunnerSqs(deploymentMessageWithEntityId(NEWER_ENTITY_ID))

      places = await PlaceModel.find<PlaceAttributes>({
        base_position: "40,40",
      })
      placeCategories = places[0].categories
      categoryRows = await PlaceCategories.findCategoriesByPlaceId(places[0].id)
      placeCategoryRows = categoryRows.map((row) => row.category_id)
      logs = await CheckScenesModel.find<CheckSceneLogs>({
        entity_id: NEWER_ENTITY_ID,
      })
      newLogActions = logs.map((log) => log.action)
    })

    it("should persist the category on the place", () => {
      expect(placeCategories).toEqual(["art"])
    })

    it("should persist the place-category relationship", () => {
      expect(placeCategoryRows).toEqual(["art"])
    })

    it("should record the new deployment action", () => {
      expect(newLogActions).toEqual([CheckSceneLogsTypes.NEW])
    })
  })

  describe("when a world replacement fails after writing its position watermark", () => {
    let enabledPlaces: PlaceAttributes[]
    let enabledTitles: string[]
    let olderTimestamp: number
    let positionWatermarkPersisted: boolean
    let recordPositions: typeof WorldDeploymentPositionWatermarkModel.recordPositions
    let recordPositionsSpy: jest.SpyInstance
    let replacementLogs: CheckSceneLogs[]
    let replacementPlaces: PlaceAttributes[]
    let replacementTombstone: Awaited<
      ReturnType<typeof WorldSceneUndeploymentModel.findSupersedingUndeployment>
    >
    let taskError: unknown
    let worldName: string

    beforeEach(async () => {
      worldName = "late-rollback-world.dcl.eth"
      olderTimestamp = Date.now() - 60_000
      await deployWorldScene({
        worldName,
        title: "Rollback Scene A",
        base: "50,50",
        parcels: ["50,50"],
        entityId: "entity-rollback-a",
        timestamp: olderTimestamp,
      })
      await deployWorldScene({
        worldName,
        title: "Rollback Scene B",
        base: "50,51",
        parcels: ["50,51"],
        entityId: "entity-rollback-b",
        timestamp: olderTimestamp,
      })

      recordPositions =
        WorldDeploymentPositionWatermarkModel.recordPositions.bind(
          WorldDeploymentPositionWatermarkModel
        )
      recordPositionsSpy = jest
        .spyOn(WorldDeploymentPositionWatermarkModel, "recordPositions")
        .mockImplementationOnce(async (worldId, positions, deployedAt) => {
          await recordPositions(worldId, positions, deployedAt)
          throw new Error("failure after position watermark")
        })

      taskError = await deployWorldScene({
        worldName,
        title: "Rolled Back Replacement",
        base: "50,50",
        parcels: ["50,50", "50,51"],
        entityId: "entity-rollback-replacement",
        timestamp: olderTimestamp + 1_000,
      }).then(
        () => null,
        (error: unknown) => error
      )

      enabledPlaces = await PlaceModel.findEnabledWorldName(worldName)
      enabledTitles = enabledPlaces.map((place) => place.title as string).sort()
      replacementPlaces = await PlaceModel.find<PlaceAttributes>({
        deployment_id: "entity-rollback-replacement",
      })
      replacementLogs = await CheckScenesModel.find<CheckSceneLogs>({
        entity_id: "entity-rollback-replacement",
      })
      positionWatermarkPersisted =
        await WorldDeploymentPositionWatermarkModel.hasSupersedingDeployment(
          worldName,
          ["50,50", "50,51"],
          new Date(olderTimestamp)
        )
      replacementTombstone =
        await WorldSceneUndeploymentModel.findSupersedingUndeployment(
          worldName,
          "entity-rollback-a",
          "50,50",
          new Date(olderTimestamp)
        )
    })

    afterEach(() => {
      recordPositionsSpy.mockRestore()
    })

    it("should surface the late persistence failure", () => {
      expect(taskError).toEqual(new Error("failure after position watermark"))
    })

    it("should restore both places disabled by the failed replacement", () => {
      expect(enabledTitles).toEqual(["Rollback Scene A", "Rollback Scene B"])
    })

    it("should roll back the replacement place", () => {
      expect(replacementPlaces).toHaveLength(0)
    })

    it("should roll back replacement logs", () => {
      expect(replacementLogs).toHaveLength(0)
    })

    it("should roll back the newer position watermark", () => {
      expect(positionWatermarkPersisted).toBe(false)
    })

    it("should roll back replacement tombstones", () => {
      expect(replacementTombstone).toBeNull()
    })
  })

  describe("when an older genesis city deployment is applied after a newer revision was already stored", () => {
    let findEnabledByPositions: jest.SpyInstance

    async function deployGenesisScene(options: {
      title: string
      base: string
      parcels: string[]
      entityId: string
    }): Promise<void> {
      mockProcessEntityId.mockResolvedValueOnce(
        createGenesisContentEntityScene(options)
      )
      mockExtractSceneJsonData.mockResolvedValueOnce({
        creator: null,
        runtimeVersion: null,
      })

      await taskRunnerSqs(deploymentMessageWithEntityId(options.entityId))
    }

    beforeEach(async () => {
      const olderTimestamp = Date.now() - 86_400_000

      await deployGenesisScene({
        title: "Newer Genesis Scene",
        base: "10,10",
        parcels: ["10,10"],
        entityId: NEWER_ENTITY_ID,
      })
      await deployGenesisScene({
        title: "Neighbour Scene",
        base: "11,11",
        parcels: ["11,11"],
        entityId: NEIGHBOUR_ENTITY_ID,
      })

      const [storedPlace] = await PlaceModel.find<PlaceAttributes>({
        base_position: "10,10",
      })
      const [neighbourPlace] = await PlaceModel.find<PlaceAttributes>({
        base_position: "11,11",
      })

      // The snapshot the older deployment would have read before the newer revision committed:
      // it resolves to an update of the stored place that also supersedes the neighbour.
      findEnabledByPositions = jest
        .spyOn(PlaceModel, "findEnabledByPositions")
        .mockResolvedValueOnce([
          {
            ...storedPlace,
            deployment_id: null,
            deployed_at: new Date(olderTimestamp - 1000),
          },
          {
            ...neighbourPlace,
            deployment_id: null,
            deployed_at: new Date(olderTimestamp - 1000),
          },
        ])

      const scene = createGenesisContentEntityScene({
        title: "Older Genesis Scene",
        base: "10,10",
        parcels: ["10,10"],
      })
      scene.timestamp = olderTimestamp

      mockProcessEntityId.mockResolvedValueOnce(scene)
      mockExtractSceneJsonData.mockResolvedValueOnce({
        creator: null,
        runtimeVersion: null,
      })

      await taskRunnerSqs(deploymentMessageWithEntityId(OLDER_ENTITY_ID))
    })

    afterEach(() => {
      findEnabledByPositions.mockRestore()
    })

    it("should keep the newer revision on the genesis place", async () => {
      const [place] = await PlaceModel.find<PlaceAttributes>({
        base_position: "10,10",
      })

      expect(place.title).toBe("Newer Genesis Scene")
    })

    it("should keep the newer deployment id on the genesis place", async () => {
      const [place] = await PlaceModel.find<PlaceAttributes>({
        base_position: "10,10",
      })

      expect(place.deployment_id).toBe(NEWER_ENTITY_ID)
    })

    it("should not disable the place the discarded deployment claimed to supersede", async () => {
      const [neighbourPlace] = await PlaceModel.find<PlaceAttributes>({
        base_position: "11,11",
      })

      expect(neighbourPlace.disabled).toBe(false)
    })

    it("should log the discarded deployment as avoided", async () => {
      const logs = await CheckScenesModel.find<CheckSceneLogs>({
        entity_id: OLDER_ENTITY_ID,
      })

      expect(logs.map((log) => log.action)).toEqual([CheckSceneLogsTypes.AVOID])
    })
  })

  describe("when a Genesis City deployment replaces an overlapping place", () => {
    let originalPlace: PlaceAttributes
    let replacementPlace: PlaceAttributes
    let enabledOverlaps: PlaceAttributes[]
    let logs: CheckSceneLogs[]
    let replacementLogActions: CheckSceneLogsTypes[]

    beforeEach(async () => {
      const originalScene = createGenesisContentEntityScene({
        title: "Original Genesis Scene",
        base: "20,20",
        parcels: ["20,20"],
      })
      mockProcessEntityId.mockResolvedValueOnce(originalScene)
      mockExtractSceneJsonData.mockResolvedValueOnce({
        creator: null,
        runtimeVersion: null,
      })
      await taskRunnerSqs(deploymentMessageWithEntityId(OLDER_ENTITY_ID))

      const replacementScene = createGenesisContentEntityScene({
        title: "Replacement Genesis Scene",
        base: "20,21",
        parcels: ["20,20", "20,21"],
      })
      replacementScene.timestamp = originalScene.timestamp + 1_000
      mockProcessEntityId.mockResolvedValueOnce(replacementScene)
      mockExtractSceneJsonData.mockResolvedValueOnce({
        creator: null,
        runtimeVersion: null,
      })
      await taskRunnerSqs(deploymentMessageWithEntityId(NEWER_ENTITY_ID))

      const originalPlaces = await PlaceModel.find<PlaceAttributes>({
        base_position: "20,20",
      })
      const replacementPlaces = await PlaceModel.find<PlaceAttributes>({
        base_position: "20,21",
      })
      originalPlace = originalPlaces[0]
      replacementPlace = replacementPlaces[0]
      enabledOverlaps = await PlaceModel.findEnabledByPositions(["20,20"])
      logs = await CheckScenesModel.find<CheckSceneLogs>({
        entity_id: NEWER_ENTITY_ID,
      })
      replacementLogActions = logs.map((log) => log.action).sort()
    })

    it("should disable the place retired by the replacement", () => {
      expect(originalPlace.disabled).toBe(true)
    })

    it("should mark the retired place as overwritten", () => {
      expect(originalPlace.disabled_reason).toBe(DisabledReason.OVERWRITTEN)
    })

    it("should keep the replacement place enabled", () => {
      expect(replacementPlace.disabled).toBe(false)
    })

    it("should leave only the replacement active at the overlapping parcel", () => {
      expect(enabledOverlaps.map((place) => place.title)).toEqual([
        "Replacement Genesis Scene",
      ])
    })

    it("should record the new and disabled actions", () => {
      expect(replacementLogActions).toEqual([
        CheckSceneLogsTypes.DISABLED,
        CheckSceneLogsTypes.NEW,
      ])
    })
  })
})
