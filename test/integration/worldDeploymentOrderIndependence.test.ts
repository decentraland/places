import { DeploymentToSqs } from "../../src/entities/CheckScenes/task/consumer"
import { extractSceneJsonData } from "../../src/entities/CheckScenes/task/extractSceneJsonData"
import {
  fetchWorldActiveScenes,
  fetchWorldActiveScenesAtPositions,
} from "../../src/entities/CheckScenes/task/fetchWorldActiveScenes"
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
const mockFetchScenes = fetchWorldActiveScenes as jest.MockedFunction<
  typeof fetchWorldActiveScenes
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

describe("when the same world events arrive in any order", () => {
  const worldName = "order-independent.dcl.eth"
  const day = 24 * 60 * 60 * 1000
  let deployStale: () => Promise<void>
  let deployServed: () => Promise<void>
  let undeployStale: () => Promise<void>

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
    const stale = Date.now() - 3 * day
    const served = Date.now() - 2 * day
    const emitted = Date.now() - day

    mockFetchScenes.mockResolvedValue({
      deploymentIds: ["entity-served"],
      positions: ["0,0"],
    })
    mockFetchScenesAtPositions.mockResolvedValue({
      deploymentIds: ["entity-served"],
      positions: ["0,0"],
    })

    deployStale = () =>
      deliverDeployment({
        worldName,
        entityId: "entity-stale",
        timestamp: stale,
        title: "Stale Scene",
        base: "0,0",
        parcels: ["0,0"],
      })
    deployServed = () =>
      deliverDeployment({
        worldName,
        entityId: "entity-served",
        timestamp: served,
        title: "Served Scene",
        base: "0,0",
        parcels: ["0,0"],
      })
    undeployStale = () =>
      undeployScene({
        worldName,
        entityId: "entity-stale",
        base: "0,0",
        emittedAt: emitted,
      })
  })

  const orderings: Array<Array<"stale" | "served" | "undeploy">> = [
    ["stale", "served", "undeploy"],
    ["stale", "undeploy", "served"],
    ["served", "stale", "undeploy"],
    ["served", "undeploy", "stale"],
    ["undeploy", "stale", "served"],
    ["undeploy", "served", "stale"],
  ]

  it.each(orderings)(
    "should converge to the served scene for order [%s, %s, %s]",
    async (...steps) => {
      const run = {
        stale: deployStale,
        served: deployServed,
        undeploy: undeployStale,
      }
      for (const step of steps) {
        await run[step]()
      }

      const enabledTitles = (
        await PlaceModel.findEnabledWorldName(worldName)
      ).map((place) => place.title)

      expect(enabledTitles).toEqual(["Served Scene"])
    }
  )
})
