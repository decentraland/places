import { DeploymentToSqs } from "../../src/entities/CheckScenes/task/consumer"
import { extractSceneJsonData } from "../../src/entities/CheckScenes/task/extractSceneJsonData"
import { handleWorldScenesUndeployment } from "../../src/entities/CheckScenes/task/handleWorldScenesUndeployment"
import { handleWorldUndeployment } from "../../src/entities/CheckScenes/task/handleWorldUndeployment"
import { processEntityId } from "../../src/entities/CheckScenes/task/processEntityId"
import { taskRunnerSqs } from "../../src/entities/CheckScenes/task/taskRunnerSqs"
import PlaceModel from "../../src/entities/Place/model"
import {
  createWorldContentEntityScene,
  createWorldDeploymentMessage,
} from "../fixtures/deploymentEvent"
import {
  createWorldScenesUndeploymentEvent,
  createWorldUndeploymentEvent,
} from "../fixtures/undeploymentEvent"
import { cleanTables, closeTestDb, initTestDb } from "../setup/db"

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

async function deliverDeployment(options: {
  worldName: string
  entityId: string
  timestamp: number
  title?: string
  base?: string
  parcels?: string[]
}): Promise<void> {
  const scene = createWorldContentEntityScene({
    worldName: options.worldName,
    title: options.title ?? "Scene",
    base: options.base ?? "0,0",
    parcels: options.parcels ?? ["0,0"],
  })
  scene.timestamp = options.timestamp

  mockProcessEntityId.mockResolvedValueOnce(scene)
  mockExtractSceneJsonData.mockResolvedValueOnce({
    creator: null,
    runtimeVersion: null,
  })

  const message = createWorldDeploymentMessage()
  const job: DeploymentToSqs = {
    ...message,
    entity: { ...message.entity, entityId: options.entityId },
  }

  await taskRunnerSqs(job)
}

describe("when a deployment is delivered after an undeployment for the same world", () => {
  let deployedAt: number
  let undeployedAt: number

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

  beforeEach(() => {
    deployedAt = Date.now() - 120_000
    undeployedAt = Date.now() - 60_000
  })

  describe("and the whole world was undeployed after that deployment was produced", () => {
    const worldName = "watermark-full.dcl.eth"

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-full",
        timestamp: deployedAt,
      })
      await handleWorldUndeployment(
        createWorldUndeploymentEvent(worldName, { timestamp: undeployedAt })
      )

      // SQS redelivers the same deployment once the undeployment has committed
      await deliverDeployment({
        worldName,
        entityId: "entity-full",
        timestamp: deployedAt,
      })
    })

    it("should not resurrect the world scene", async () => {
      expect(await PlaceModel.findEnabledWorldName(worldName)).toHaveLength(0)
    })
  })

  describe("and the scene was undeployed after that deployment was produced", () => {
    const worldName = "watermark-scene.dcl.eth"

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-scene",
        timestamp: deployedAt,
      })
      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [{ entityId: "entity-scene", baseParcel: "0,0" }],
          { timestamp: undeployedAt }
        )
      )

      await deliverDeployment({
        worldName,
        entityId: "entity-scene",
        timestamp: deployedAt,
      })
    })

    it("should not resurrect the undeployed scene", async () => {
      expect(await PlaceModel.findEnabledWorldName(worldName)).toHaveLength(0)
    })
  })

  describe("and the scene undeployment arrived before the deployment it refers to", () => {
    const worldName = "watermark-out-of-order.dcl.eth"

    beforeEach(async () => {
      // No place row exists yet, so only a durable watermark can carry this
      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [{ entityId: "entity-unknown", baseParcel: "0,0" }],
          { timestamp: undeployedAt }
        )
      )

      await deliverDeployment({
        worldName,
        entityId: "entity-unknown",
        timestamp: deployedAt,
      })
    })

    it("should not create the place the undeployment already retired", async () => {
      expect(await PlaceModel.findEnabledWorldName(worldName)).toHaveLength(0)
    })
  })

  describe("and an older revision of an undeployed scene is redelivered", () => {
    const worldName = "watermark-older-revision.dcl.eth"

    beforeEach(async () => {
      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [{ entityId: "entity-newer-revision", baseParcel: "0,0" }],
          { timestamp: undeployedAt }
        )
      )

      // A different, older revision of the same scene at the same base position
      await deliverDeployment({
        worldName,
        entityId: "entity-older-revision",
        timestamp: deployedAt,
      })
    })

    it("should not create the place from the older revision", async () => {
      expect(await PlaceModel.findEnabledWorldName(worldName)).toHaveLength(0)
    })
  })

  describe("and an undeployed scene changed base position in a newer revision", () => {
    const worldName = "watermark-reshaped-revision.dcl.eth"
    let updatedAt: number

    beforeEach(async () => {
      updatedAt = deployedAt + 30_000
      await deliverDeployment({
        worldName,
        entityId: "entity-before-reshape",
        timestamp: deployedAt,
        base: "0,0",
        parcels: ["0,0", "1,0"],
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-after-reshape",
        timestamp: updatedAt,
        base: "1,0",
        parcels: ["1,0", "2,0"],
      })
      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [{ entityId: "entity-after-reshape", baseParcel: "1,0" }],
          { timestamp: undeployedAt }
        )
      )

      // The older revision has a different deployment id and base from the explicit
      // undeployment. Its replacement tombstone must still prevent a delayed replay.
      await deliverDeployment({
        worldName,
        entityId: "entity-before-reshape",
        timestamp: deployedAt,
        base: "0,0",
        parcels: ["0,0", "1,0"],
      })
    })

    it("should not recreate the older revision at its previous base", async () => {
      expect(await PlaceModel.findEnabledWorldName(worldName)).toHaveLength(0)
    })
  })

  describe("and the deployment was produced after the undeployment", () => {
    const worldName = "watermark-redeploy.dcl.eth"

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-redeploy",
        timestamp: deployedAt,
      })
      await handleWorldUndeployment(
        createWorldUndeploymentEvent(worldName, { timestamp: undeployedAt })
      )

      // A genuine redeployment: same content hash is allowed, the timestamp is what matters
      await deliverDeployment({
        worldName,
        entityId: "entity-redeploy",
        timestamp: Date.now(),
        title: "Redeployed Scene",
      })
    })

    it("should create the place again", async () => {
      expect(await PlaceModel.findEnabledWorldName(worldName)).toHaveLength(1)
    })

    it("should store the redeployed metadata", async () => {
      const [place] = await PlaceModel.findEnabledWorldName(worldName)

      expect(place.title).toBe("Redeployed Scene")
    })
  })

  describe("and an unrelated scene in the same world has an older deployment", () => {
    const worldName = "watermark-sibling.dcl.eth"

    beforeEach(async () => {
      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [{ entityId: "entity-undeployed", baseParcel: "0,0" }],
          { timestamp: undeployedAt }
        )
      )

      // Different scene, different base position: the scene watermark must not block it
      await deliverDeployment({
        worldName,
        entityId: "entity-sibling",
        timestamp: deployedAt,
        title: "Sibling Scene",
        base: "5,5",
        parcels: ["5,5"],
      })
    })

    it("should create the unrelated scene", async () => {
      const enabled = await PlaceModel.findEnabledWorldName(worldName)

      expect(enabled.map((place) => place.title)).toEqual(["Sibling Scene"])
    })
  })
})
