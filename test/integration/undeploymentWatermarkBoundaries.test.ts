import supertest from "supertest"

import { DeploymentToSqs } from "../../src/entities/CheckScenes/task/consumer"
import { extractSceneJsonData } from "../../src/entities/CheckScenes/task/extractSceneJsonData"
import { handleWorldScenesUndeployment } from "../../src/entities/CheckScenes/task/handleWorldScenesUndeployment"
import { handleWorldUndeployment } from "../../src/entities/CheckScenes/task/handleWorldUndeployment"
import { processEntityId } from "../../src/entities/CheckScenes/task/processEntityId"
import { taskRunnerSqs } from "../../src/entities/CheckScenes/task/taskRunnerSqs"
import PlaceModel from "../../src/entities/Place/model"
import WorldSceneUndeploymentModel from "../../src/entities/WorldSceneUndeployment/model"
import {
  createWorldContentEntityScene,
  createWorldDeploymentMessage,
} from "../fixtures/deploymentEvent"
import {
  createWorldScenesUndeploymentEvent,
  createWorldUndeploymentEvent,
} from "../fixtures/undeploymentEvent"
import { cleanTables, closeTestDb, initTestDb } from "../setup/db"
import { createTestApp } from "../setup/server"

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

const app = createTestApp()
const DAY = 24 * 60 * 60 * 1000

async function deliverDeployment(options: {
  worldName: string
  entityId: string
  timestamp: number
  title?: string
}): Promise<void> {
  const scene = createWorldContentEntityScene({
    worldName: options.worldName,
    title: options.title ?? "Scene",
    base: "0,0",
    parcels: ["0,0"],
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

describe("when an undeployment supersedes a world deployment", () => {
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
    deployedAt = Date.now() - 2 * DAY
    undeployedAt = Date.now() - DAY
  })

  describe("and the scene undeployment arrived before the deployment it refers to", () => {
    const worldName = "boundary-scene-first.dcl.eth"
    let worldStatus: number

    beforeEach(async () => {
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
        title: "Ghost Scene",
      })

      worldStatus = (await supertest(app).get(`/api/worlds/${worldName}`))
        .status
    })

    it("should not create the place", async () => {
      expect(await PlaceModel.findEnabledWorldName(worldName)).toHaveLength(0)
    })

    it("should not publish the world through the direct world lookup", () => {
      expect(worldStatus).toBe(404)
    })
  })

  describe("and the world undeployment arrived before any deployment", () => {
    const worldName = "boundary-world-first.dcl.eth"
    let worldStatus: number

    beforeEach(async () => {
      await handleWorldUndeployment(
        createWorldUndeploymentEvent(worldName, { timestamp: undeployedAt })
      )

      await deliverDeployment({
        worldName,
        entityId: "entity-world",
        timestamp: deployedAt,
        title: "Ghost World",
      })

      worldStatus = (await supertest(app).get(`/api/worlds/${worldName}`))
        .status
    })

    it("should not create the place", async () => {
      expect(await PlaceModel.findEnabledWorldName(worldName)).toHaveLength(0)
    })

    it("should not publish the world through the direct world lookup", () => {
      expect(worldStatus).toBe(404)
    })
  })
})

describe("when a world undeployment carries the same timestamp as the deployment", () => {
  let sharedTimestamp: number

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
    sharedTimestamp = Date.now() - DAY
  })

  describe("and the deployment was processed first", () => {
    const worldName = "boundary-tie-deploy-first.dcl.eth"

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-tie",
        timestamp: sharedTimestamp,
      })
      await handleWorldUndeployment(
        createWorldUndeploymentEvent(worldName, { timestamp: sharedTimestamp })
      )
    })

    it("should disable the place the undeployment ties with", async () => {
      expect(await PlaceModel.findEnabledWorldName(worldName)).toHaveLength(0)
    })
  })

  describe("and the undeployment was processed first", () => {
    const worldName = "boundary-tie-undeploy-first.dcl.eth"

    beforeEach(async () => {
      await handleWorldUndeployment(
        createWorldUndeploymentEvent(worldName, { timestamp: sharedTimestamp })
      )
      await deliverDeployment({
        worldName,
        entityId: "entity-tie",
        timestamp: sharedTimestamp,
      })
    })

    it("should not create the place the undeployment ties with", async () => {
      expect(await PlaceModel.findEnabledWorldName(worldName)).toHaveLength(0)
    })
  })
})

describe("when a scene undeployment carries the same timestamp as the deployment", () => {
  let sharedTimestamp: number

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
    sharedTimestamp = Date.now() - DAY
  })

  describe("and the deployment was processed first", () => {
    const worldName = "boundary-scene-tie-deploy-first.dcl.eth"

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-scene-tie",
        timestamp: sharedTimestamp,
      })
      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [{ entityId: "entity-scene-tie", baseParcel: "0,0" }],
          { timestamp: sharedTimestamp }
        )
      )
    })

    it("should disable the place the undeployment ties with", async () => {
      expect(await PlaceModel.findEnabledWorldName(worldName)).toHaveLength(0)
    })
  })

  describe("and the undeployment was processed first", () => {
    const worldName = "boundary-scene-tie-undeploy-first.dcl.eth"

    beforeEach(async () => {
      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [{ entityId: "entity-scene-tie", baseParcel: "0,0" }],
          { timestamp: sharedTimestamp }
        )
      )
      await deliverDeployment({
        worldName,
        entityId: "entity-scene-tie",
        timestamp: sharedTimestamp,
      })
    })

    it("should not create the place the undeployment ties with", async () => {
      expect(await PlaceModel.findEnabledWorldName(worldName)).toHaveLength(0)
    })
  })
})

describe("when a delayed scene undeployment repeats a recorded deployment id", () => {
  const worldName = "boundary-conflict.dcl.eth"
  let olderTimestamp: number
  let newerTimestamp: number

  beforeAll(async () => {
    await initTestDb()
  })

  afterAll(async () => {
    await closeTestDb()
  })

  afterEach(async () => {
    await cleanTables()
  })

  beforeEach(async () => {
    olderTimestamp = Date.now() - 2 * DAY
    newerTimestamp = Date.now() - DAY

    await WorldSceneUndeploymentModel.recordScenes(worldName, [
      {
        entityId: "entity-conflict",
        baseParcel: "5,5",
        undeployedAt: new Date(newerTimestamp),
        basePositionRejects: true,
      },
    ])
    // Same deployment id, older event, disagreeing base position
    await WorldSceneUndeploymentModel.recordScenes(worldName, [
      {
        entityId: "entity-conflict",
        baseParcel: "0,0",
        undeployedAt: new Date(olderTimestamp),
        basePositionRejects: true,
      },
    ])
  })

  it("should keep superseding deployments at the base position of the newest event", async () => {
    const superseding =
      await WorldSceneUndeploymentModel.findSupersedingUndeployment(
        worldName,
        "unrelated-deployment",
        "5,5",
        new Date(olderTimestamp)
      )

    expect(superseding).not.toBeNull()
  })

  it("should not adopt the base position carried by the older event", async () => {
    const superseding =
      await WorldSceneUndeploymentModel.findSupersedingUndeployment(
        worldName,
        "unrelated-deployment",
        "0,0",
        new Date(olderTimestamp)
      )

    expect(superseding).toBeNull()
  })
})
