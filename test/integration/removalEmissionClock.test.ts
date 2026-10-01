import { DeploymentToSqs } from "../../src/entities/CheckScenes/task/consumer"
import { extractSceneJsonData } from "../../src/entities/CheckScenes/task/extractSceneJsonData"
import {
  fetchWorldActiveScenes,
  fetchWorldActiveScenesAtPositions,
} from "../../src/entities/CheckScenes/task/fetchWorldActiveScenes"
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

jest.mock("../../src/entities/CheckScenes/task/processEntityId")
jest.mock("../../src/entities/CheckScenes/task/extractSceneJsonData")
jest.mock("../../src/entities/CheckScenes/task/fetchWorldActiveScenes")

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

const mockProcessEntityId = jest.mocked(processEntityId)
const mockExtractSceneJsonData = jest.mocked(extractSceneJsonData)
const mockFetchScenes = jest.mocked(fetchWorldActiveScenes)
const mockFetchScenesAtPositions = jest.mocked(
  fetchWorldActiveScenesAtPositions
)

const minute = 60 * 1000
const day = 24 * 60 * minute

type Deployment = {
  entityId: string
  title: string
  parcels: string[]
  /** Entity timestamp, set by the client when it signs. */
  signedAt: number
  /** Event timestamp, set by the worlds content server after committing. */
  emittedAt?: number
}

async function deliverDeployment(
  worldName: string,
  deployment: Deployment
): Promise<void> {
  const scene = createWorldContentEntityScene({
    worldName,
    title: deployment.title,
    base: deployment.parcels[0],
    parcels: deployment.parcels,
  })
  scene.timestamp = deployment.signedAt

  mockProcessEntityId.mockResolvedValueOnce(scene)
  mockExtractSceneJsonData.mockResolvedValueOnce({
    creator: null,
    runtimeVersion: null,
  })

  const message = createWorldDeploymentMessage()
  const job = {
    ...message,
    entity: { ...message.entity, entityId: deployment.entityId },
    ...(deployment.emittedAt === undefined
      ? {}
      : { timestamp: deployment.emittedAt }),
  } as DeploymentToSqs

  await taskRunnerSqs(job)
}

async function undeployScenes(
  worldName: string,
  deployments: Deployment[],
  emittedAt: number
): Promise<void> {
  await handleWorldScenesUndeployment(
    createWorldScenesUndeploymentEvent(
      worldName,
      deployments.map((deployment) => ({
        entityId: deployment.entityId,
        baseParcel: deployment.parcels[0],
        parcels: deployment.parcels,
      })),
      { timestamp: emittedAt }
    )
  )
}

async function enabledTitles(worldName: string): Promise<Array<string | null>> {
  return (await PlaceModel.findEnabledWorldName(worldName))
    .map((place) => place.title)
    .sort()
}

describe("when removals are compared against deployments on the worlds content server clock", () => {
  let worldName: string
  let originalAt: number
  let removedAt: number
  let first: Deployment
  let second: Deployment
  let replacement: Deployment
  let titles: Array<string | null>

  beforeAll(async () => {
    await initTestDb()
  })

  afterAll(async () => {
    await closeTestDb()
  })

  beforeEach(() => {
    originalAt = Date.now() - 2 * day
    removedAt = Date.now() - day
    first = {
      entityId: "entity-first",
      title: "First Scene",
      parcels: ["0,0"],
      signedAt: originalAt,
      emittedAt: originalAt + 2000,
    }
    second = {
      entityId: "entity-second",
      title: "Second Scene",
      parcels: ["1,0"],
      signedAt: originalAt,
      emittedAt: originalAt + 3000,
    }
    // Signed before the removal, deployed after it: the flow that delisted worlds.
    replacement = {
      entityId: "entity-replacement",
      title: "Replacement Scene",
      parcels: ["0,0"],
      signedAt: removedAt - 2 * minute,
      emittedAt: removedAt + 30_000,
    }
    mockFetchScenes.mockResolvedValue({ deploymentIds: [], positions: [] })
    mockFetchScenesAtPositions.mockResolvedValue({
      deploymentIds: [],
      positions: [],
    })
  })

  afterEach(async () => {
    await cleanTables()
    jest.clearAllMocks()
  })

  describe("and a single scene replaces a multi-scene world after its scenes were undeployed", () => {
    beforeEach(async () => {
      worldName = "single-replacement.dcl.eth"
      await deliverDeployment(worldName, first)
      await deliverDeployment(worldName, second)
      await undeployScenes(worldName, [first, second], removedAt)
      await deliverDeployment(worldName, replacement)
      titles = await enabledTitles(worldName)
    })

    it("should list the replacement scene", () => {
      expect(titles).toEqual(["Replacement Scene"])
    })

    describe("and a removed scene is redelivered", () => {
      beforeEach(async () => {
        await deliverDeployment(worldName, first)
        titles = await enabledTitles(worldName)
      })

      it("should keep the removed scene out", () => {
        expect(titles).toEqual(["Replacement Scene"])
      })
    })
  })

  describe("and an older revision at a removed base arrives after the removal", () => {
    beforeEach(async () => {
      worldName = "late-older-revision.dcl.eth"
      await deliverDeployment(worldName, first)
      await undeployScenes(worldName, [first], removedAt)
      await deliverDeployment(worldName, {
        entityId: "entity-older-revision",
        title: "Older Revision",
        parcels: ["0,0"],
        signedAt: originalAt - day,
        emittedAt: originalAt - day + 2000,
      })
      titles = await enabledTitles(worldName)
    })

    it("should reject the revision the removal retired", () => {
      expect(titles).toEqual([])
    })
  })

  describe("and a world is torn down and redeployed with a scene signed before the teardown", () => {
    beforeEach(async () => {
      worldName = "teardown-redeploy.dcl.eth"
      await deliverDeployment(worldName, first)
      await handleWorldUndeployment(
        createWorldUndeploymentEvent(worldName, { timestamp: removedAt })
      )
      await deliverDeployment(worldName, replacement)
      titles = await enabledTitles(worldName)
    })

    it("should list the redeployed scene", () => {
      expect(titles).toEqual(["Replacement Scene"])
    })

    describe("and a scene from before the teardown is redelivered", () => {
      beforeEach(async () => {
        await deliverDeployment(worldName, second)
        titles = await enabledTitles(worldName)
      })

      it("should keep the torn-down scene out", () => {
        expect(titles).toEqual(["Replacement Scene"])
      })
    })
  })

  describe("and a world undeployment is handled while the world already serves a later deployment", () => {
    beforeEach(async () => {
      worldName = "reshaped-world.dcl.eth"
      await deliverDeployment(worldName, first)
      mockFetchScenes.mockResolvedValue({
        deploymentIds: [replacement.entityId],
        positions: replacement.parcels,
      })
      await handleWorldUndeployment(
        createWorldUndeploymentEvent(worldName, { timestamp: removedAt })
      )
      // Emitted before the teardown at parcels no place row ever held, so nothing local names it.
      await deliverDeployment(worldName, {
        entityId: "entity-never-seen",
        title: "Never Seen Scene",
        parcels: ["9,9"],
        signedAt: removedAt - 10 * minute,
        emittedAt: removedAt - 9 * minute,
      })
      await deliverDeployment(worldName, replacement)
      titles = await enabledTitles(worldName)
    })

    it("should list only the scene deployed after the teardown", () => {
      expect(titles).toEqual(["Replacement Scene"])
    })
  })

  describe("and older deployments arrive after newer ones replaced them", () => {
    beforeEach(async () => {
      worldName = "reordered-deployments.dcl.eth"
      const deployments: Deployment[] = [1, 2, 3].map((revision) => ({
        entityId: `entity-revision-${revision}`,
        title: `Revision ${revision}`,
        parcels: ["0,0"],
        signedAt: originalAt + revision * minute,
        emittedAt: originalAt + revision * minute + 2000,
      }))
      await deliverDeployment(worldName, deployments[1])
      await deliverDeployment(worldName, deployments[2])
      await deliverDeployment(worldName, deployments[0])
      titles = await enabledTitles(worldName)
    })

    it("should keep the newest revision by entity timestamp", () => {
      expect(titles).toEqual(["Revision 3"])
    })
  })

  describe("and a deployment message carries no emission time", () => {
    beforeEach(async () => {
      worldName = "no-emission-time.dcl.eth"
      await deliverDeployment(worldName, first)
      await undeployScenes(worldName, [first], removedAt)
      await deliverDeployment(worldName, {
        ...replacement,
        emittedAt: undefined,
      })
      titles = await enabledTitles(worldName)
    })

    it("should judge it by its entity timestamp, which predates the removal", () => {
      expect(titles).toEqual([])
    })
  })
})
