import supertest from "supertest"

import { DeploymentToSqs } from "../../src/entities/CheckScenes/task/consumer"
import { extractSceneJsonData } from "../../src/entities/CheckScenes/task/extractSceneJsonData"
import { handleWorldScenesUndeployment } from "../../src/entities/CheckScenes/task/handleWorldScenesUndeployment"
import { processEntityId } from "../../src/entities/CheckScenes/task/processEntityId"
import { taskRunnerSqs } from "../../src/entities/CheckScenes/task/taskRunnerSqs"
import PlaceModel from "../../src/entities/Place/model"
import {
  createWorldContentEntityScene,
  createWorldDeploymentMessage,
} from "../fixtures/deploymentEvent"
import { createWorldScenesUndeploymentEvent } from "../fixtures/undeploymentEvent"
import { cleanTables, closeTestDb, initTestDb } from "../setup/db"
import { createTestApp } from "../setup/server"

jest.mock("../../src/entities/CheckScenes/task/processEntityId")
jest.mock("../../src/entities/CheckScenes/task/extractSceneJsonData")
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
  title: string
  base: string
  parcels: string[]
}): Promise<void> {
  const scene = createWorldContentEntityScene({
    worldName: options.worldName,
    title: options.title,
    base: options.base,
    parcels: options.parcels,
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

describe("when a single scene replaces a multi-scene world", () => {
  const day = 24 * 60 * 60 * 1000
  let app: ReturnType<typeof createTestApp>
  let replacedDeployedAt: number
  let replacementDeployedAt: number
  let undeploymentEmittedAt: number

  beforeAll(async () => {
    await initTestDb()
    app = createTestApp()
  })

  afterAll(async () => {
    await closeTestDb()
  })

  afterEach(async () => {
    await cleanTables()
    jest.clearAllMocks()
  })

  beforeEach(() => {
    replacedDeployedAt = Date.now() - 2 * day
    replacementDeployedAt = Date.now() - day
    undeploymentEmittedAt = replacementDeployedAt + 1000
  })

  describe("and the replacement is deployed after the replaced scenes were undeployed", () => {
    const worldName = "stale-multi-scene.dcl.eth"
    let enabledTitles: Array<string | null>
    let listBody: { total: number; data: Array<{ title: string | null }> }

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-old-a",
        timestamp: replacedDeployedAt,
        title: "Old Scene A",
        base: "0,0",
        parcels: ["0,0"],
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-old-b",
        timestamp: replacedDeployedAt,
        title: "Old Scene B",
        base: "0,6",
        parcels: ["0,6"],
      })

      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [
            { entityId: "entity-old-a", baseParcel: "0,0", parcels: ["0,0"] },
            { entityId: "entity-old-b", baseParcel: "0,6", parcels: ["0,6"] },
          ],
          { timestamp: undeploymentEmittedAt }
        )
      )

      await deliverDeployment({
        worldName,
        entityId: "entity-replacement",
        timestamp: replacementDeployedAt,
        title: "Replacement Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
        (place) => place.title
      )
      listBody = (
        await supertest(app).get(
          `/api/places?names=${encodeURIComponent(worldName)}`
        )
      ).body
    })

    it("should keep the single replacement scene enabled", () => {
      expect(enabledTitles).toEqual(["Replacement Scene"])
    })

    it("should list the world through the public places endpoint", () => {
      expect(listBody.total).toBe(1)
    })
  })

  describe("and a removed scene is redelivered after its undeployment", () => {
    const worldName = "stale-redelivery.dcl.eth"
    let enabledTitles: Array<string | null>

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-gone",
        timestamp: replacedDeployedAt,
        title: "Gone Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [{ entityId: "entity-gone", baseParcel: "0,0", parcels: ["0,0"] }],
          { timestamp: undeploymentEmittedAt }
        )
      )

      await deliverDeployment({
        worldName,
        entityId: "entity-gone",
        timestamp: replacedDeployedAt,
        title: "Gone Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
        (place) => place.title
      )
    })

    it("should keep the redelivered removed scene disabled", () => {
      expect(enabledTitles).toEqual([])
    })
  })
})
