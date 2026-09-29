import supertest from "supertest"

import { DeploymentToSqs } from "../../src/entities/CheckScenes/task/consumer"
import { WorldDeploymentUnresolvedError } from "../../src/entities/CheckScenes/task/errors"
import { extractSceneJsonData } from "../../src/entities/CheckScenes/task/extractSceneJsonData"
import { fetchWorldActiveScenesAtPositions } from "../../src/entities/CheckScenes/task/fetchWorldActiveScenes"
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
const mockFetchScenesAtPositions =
  fetchWorldActiveScenesAtPositions as jest.MockedFunction<
    typeof fetchWorldActiveScenesAtPositions
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

async function undeployScene(options: {
  worldName: string
  entityId: string
  base: string
  emittedAt: number
}): Promise<void> {
  await handleWorldScenesUndeployment(
    createWorldScenesUndeploymentEvent(
      options.worldName,
      [
        {
          entityId: options.entityId,
          baseParcel: options.base,
          parcels: [options.base],
        },
      ],
      { timestamp: options.emittedAt }
    )
  )
}

describe("when a world deployment conflicts with a durable watermark", () => {
  const day = 24 * 60 * 60 * 1000
  let app: ReturnType<typeof createTestApp>
  let olderAt: number
  let replacementAt: number
  let emittedAt: number

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
    olderAt = Date.now() - 2 * day
    replacementAt = Date.now() - day
    emittedAt = replacementAt + 1000
  })

  describe("and the content server still serves the single scene that replaced a multi-scene world", () => {
    const worldName = "verified-replacement.dcl.eth"
    let enabledTitles: Array<string | null>
    let verifyCalls: unknown[][]
    let listedTotal: number

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-replaced",
        timestamp: olderAt,
        title: "Replaced Scene",
        base: "0,0",
        parcels: ["0,0"],
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-replaced-sibling",
        timestamp: olderAt,
        title: "Replaced Sibling Scene",
        base: "0,6",
        parcels: ["0,6"],
      })
      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [
            {
              entityId: "entity-replaced",
              baseParcel: "0,0",
              parcels: ["0,0"],
            },
            {
              entityId: "entity-replaced-sibling",
              baseParcel: "0,6",
              parcels: ["0,6"],
            },
          ],
          { timestamp: emittedAt }
        )
      )
      mockFetchScenesAtPositions.mockClear()

      mockFetchScenesAtPositions.mockResolvedValueOnce({
        deploymentIds: ["entity-replacement"],
        positions: ["0,0"],
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-replacement",
        timestamp: replacementAt,
        title: "Replacement Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      verifyCalls = [...mockFetchScenesAtPositions.mock.calls]
      enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
        (place) => place.title
      )
      listedTotal = (
        await supertest(app).get(
          `/api/places?names=${encodeURIComponent(worldName)}`
        )
      ).body.total
    })

    it("should admit the deployment the content server confirms", () => {
      expect(enabledTitles).toEqual(["Replacement Scene"])
    })

    it("should list the world through the public places endpoint", () => {
      expect(listedTotal).toBe(1)
    })

    it("should verify the scene base against the content server exactly once", () => {
      expect(verifyCalls).toEqual([[worldName, ["0,0"]]])
    })

    describe("and the admitted deployment is redelivered", () => {
      let redeliveryCallCount: number

      beforeEach(async () => {
        mockFetchScenesAtPositions.mockClear()
        await deliverDeployment({
          worldName,
          entityId: "entity-replacement",
          timestamp: replacementAt,
          title: "Replacement Scene",
          base: "0,0",
          parcels: ["0,0"],
        })
        redeliveryCallCount = mockFetchScenesAtPositions.mock.calls.length
      })

      it("should not ask the content server again", () => {
        expect(redeliveryCallCount).toBe(0)
      })
    })
  })

  describe("and the world is torn down while the deploying entity's served scenes are read", () => {
    const worldName = "torn-down-mid-verify.dcl.eth"
    let enabledTitles: Array<string | null>
    let verifyCallCount: number

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-cleared",
        timestamp: olderAt,
        title: "Cleared Scene",
        base: "0,0",
        parcels: ["0,0"],
      })
      await undeployScene({
        worldName,
        entityId: "entity-cleared",
        base: "0,0",
        emittedAt,
      })
      mockFetchScenesAtPositions.mockClear()

      mockFetchScenesAtPositions.mockImplementationOnce(async () => {
        await handleWorldUndeployment(
          createWorldUndeploymentEvent(worldName, {
            timestamp: emittedAt + 1000,
          })
        )
        return { deploymentIds: ["entity-arriving"], positions: ["0,0"] }
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-arriving",
        timestamp: replacementAt,
        title: "Arriving Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      verifyCallCount = mockFetchScenesAtPositions.mock.calls.length
      enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
        (place) => place.title
      )
    })

    it("should not admit the deployment from the served list the teardown made stale", () => {
      expect(enabledTitles).toEqual([])
    })

    it("should read the served scenes again after the teardown", () => {
      expect(verifyCallCount).toBe(2)
    })
  })

  describe("and the world keeps being torn down while the served scenes are read", () => {
    const worldName = "churning-world.dcl.eth"
    let error: unknown
    let enabledTitles: Array<string | null>
    let verifyCallCount: number

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-cleared",
        timestamp: olderAt,
        title: "Cleared Scene",
        base: "0,0",
        parcels: ["0,0"],
      })
      await undeployScene({
        worldName,
        entityId: "entity-cleared",
        base: "0,0",
        emittedAt,
      })
      mockFetchScenesAtPositions.mockClear()

      for (const offset of [1000, 2000]) {
        mockFetchScenesAtPositions.mockImplementationOnce(async () => {
          await handleWorldUndeployment(
            createWorldUndeploymentEvent(worldName, {
              timestamp: emittedAt + offset,
            })
          )
          return { deploymentIds: ["entity-arriving"], positions: ["0,0"] }
        })
      }
      error = await deliverDeployment({
        worldName,
        entityId: "entity-arriving",
        timestamp: replacementAt,
        title: "Arriving Scene",
        base: "0,0",
        parcels: ["0,0"],
      }).catch((reason: unknown) => reason)

      verifyCallCount = mockFetchScenesAtPositions.mock.calls.length
      enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
        (place) => place.title
      )
    })

    it("should give up with an error so the message is retried", () => {
      expect(error).toBeInstanceOf(WorldDeploymentUnresolvedError)
    })

    it("should stop after the bounded number of reads", () => {
      expect(verifyCallCount).toBe(2)
    })

    it("should not admit the deployment", () => {
      expect(enabledTitles).toEqual([])
    })
  })

  describe("and the content server no longer serves the deploying entity", () => {
    const worldName = "unverified-stale.dcl.eth"
    let enabledTitles: Array<string | null>

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-newer-revision",
        timestamp: replacementAt,
        title: "Newer Revision",
        base: "0,0",
        parcels: ["0,0"],
      })
      await undeployScene({
        worldName,
        entityId: "entity-newer-revision",
        base: "0,0",
        emittedAt,
      })

      await deliverDeployment({
        worldName,
        entityId: "entity-older-revision",
        timestamp: olderAt,
        title: "Older Revision",
        base: "0,0",
        parcels: ["0,0"],
      })

      enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
        (place) => place.title
      )
    })

    it("should reject the stale deployment the content server no longer serves", () => {
      expect(enabledTitles).toEqual([])
    })
  })

  describe("and an entity-timestamped deployment watermark shadows a reordered older deployment", () => {
    const worldName = "reordered-shadowed.dcl.eth"
    const first = Date.now() - 3 * day
    const second = Date.now() - 2 * day
    const third = Date.now() - day
    let enabledTitles: Array<string | null>

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-b",
        timestamp: second,
        title: "Scene B",
        base: "0,0",
        parcels: ["0,0", "0,1"],
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-c",
        timestamp: third,
        title: "Scene C",
        base: "0,1",
        parcels: ["0,1", "0,2"],
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-a",
        timestamp: first,
        title: "Scene A",
        base: "0,0",
        parcels: ["0,0"],
      })

      enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
        (place) => place.title
      )
    })

    it("should reject the reordered older deployment the content server does not serve", () => {
      expect(enabledTitles).toEqual(["Scene C"])
    })
  })

  describe("and the same tombstoned entity is redelivered", () => {
    const worldName = "redelivered-tombstone.dcl.eth"
    let enabledTitles: Array<string | null>

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-gone",
        timestamp: olderAt,
        title: "Gone Scene",
        base: "0,0",
        parcels: ["0,0"],
      })
      await undeployScene({
        worldName,
        entityId: "entity-gone",
        base: "0,0",
        emittedAt,
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-gone",
        timestamp: olderAt,
        title: "Gone Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
        (place) => place.title
      )
    })

    it("should keep the redelivered tombstoned entity disabled", () => {
      expect(enabledTitles).toEqual([])
    })
  })
})
