import {
  disableOrphanPlaces,
  readPlaceRevisions,
} from "../../bin/rebuildWorldPlaces"
import { DeploymentToSqs } from "../../src/entities/CheckScenes/task/consumer"
import { extractSceneJsonData } from "../../src/entities/CheckScenes/task/extractSceneJsonData"
import { processEntityId } from "../../src/entities/CheckScenes/task/processEntityId"
import { taskRunnerSqs } from "../../src/entities/CheckScenes/task/taskRunnerSqs"
import PlaceModel from "../../src/entities/Place/model"
import {
  createWorldContentEntityScene,
  createWorldDeploymentMessage,
} from "../fixtures/deploymentEvent"
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

function emptyStats() {
  return {
    created: 0,
    updated: 0,
    disabled: 0,
    skipped: 0,
    errored: 0,
  }
}

/**
 * The orphan sweep is the only code here that disables places from a derived argument rather than an
 * event, and it reasons from a scene listing read before it holds the lock. So what it must never do
 * is disable a place that listing could not describe.
 */
describe("when sweeping orphan places for a world", () => {
  const day = 24 * 60 * 60 * 1000
  let firstDeployedAt: number

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
    firstDeployedAt = Date.now() - 2 * day
  })

  describe("and a place has no scene accounting for it", () => {
    const worldName = "sweep-orphan.dcl.eth"
    let enabledTitles: Array<string | null>

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-orphan",
        timestamp: firstDeployedAt,
        title: "Orphan Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      const placeRevisions = await readPlaceRevisions(worldName)

      await disableOrphanPlaces({
        worldName,
        worldId: worldName,
        knownPlaceIds: new Set(),
        placeRevisions,
        dryRun: false,
        stats: emptyStats(),
      })

      enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
        (place) => place.title
      )
    })

    it("should disable it", () => {
      expect(enabledTitles).toEqual([])
    })
  })

  describe("and a scene accounted for the place", () => {
    const worldName = "sweep-known.dcl.eth"
    let enabledTitles: Array<string | null>

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-known",
        timestamp: firstDeployedAt,
        title: "Known Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      const places = await PlaceModel.findByWorldId(worldName)
      const placeRevisions = await readPlaceRevisions(worldName)

      await disableOrphanPlaces({
        worldName,
        worldId: worldName,
        knownPlaceIds: new Set(places.map((place) => place.id)),
        placeRevisions,
        dryRun: false,
        stats: emptyStats(),
      })

      enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
        (place) => place.title
      )
    })

    it("should leave it enabled", () => {
      expect(enabledTitles).toEqual(["Known Scene"])
    })
  })

  describe("and a place was created after the scene listing was read", () => {
    const worldName = "sweep-created-after.dcl.eth"
    let enabledTitles: Array<string | null>

    beforeEach(async () => {
      // the revisions are captured first, standing in for the moment the listing was read
      const placeRevisions = await readPlaceRevisions(worldName)

      await deliverDeployment({
        worldName,
        entityId: "entity-raced",
        timestamp: Date.now(),
        title: "Raced Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      await disableOrphanPlaces({
        worldName,
        worldId: worldName,
        knownPlaceIds: new Set(),
        placeRevisions,
        dryRun: false,
        stats: emptyStats(),
      })

      enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
        (place) => place.title
      )
    })

    it("should leave it enabled, since that listing could not describe it", () => {
      expect(enabledTitles).toEqual(["Raced Scene"])
    })
  })

  describe("and a place was replaced in situ after the scene listing was read", () => {
    const worldName = "sweep-replaced-after.dcl.eth"
    let enabledTitles: Array<string | null>
    let sameRow: boolean

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-original",
        timestamp: firstDeployedAt,
        title: "Original Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      const before = await PlaceModel.findByWorldId(worldName)
      const placeRevisions = await readPlaceRevisions(worldName)

      // a replacement reuses the row it replaces, so the id is unchanged and only the revision moves
      await deliverDeployment({
        worldName,
        entityId: "entity-replacement",
        timestamp: Date.now(),
        title: "Replacement Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      const after = await PlaceModel.findByWorldId(worldName)
      sameRow = before[0].id === after[0].id && after.length === 1

      await disableOrphanPlaces({
        worldName,
        worldId: worldName,
        knownPlaceIds: new Set(),
        placeRevisions,
        dryRun: false,
        stats: emptyStats(),
      })

      enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
        (place) => place.title
      )
    })

    it("should have reused the same row, which is what makes ids insufficient", () => {
      expect(sameRow).toBe(true)
    })

    it("should leave the replacement enabled", () => {
      expect(enabledTitles).toEqual(["Replacement Scene"])
    })
  })

  describe("and the run is a dry run", () => {
    const worldName = "sweep-dry-run.dcl.eth"
    let enabledTitles: Array<string | null>

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-dry",
        timestamp: firstDeployedAt,
        title: "Dry Run Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      const placeRevisions = await readPlaceRevisions(worldName)

      await disableOrphanPlaces({
        worldName,
        worldId: worldName,
        knownPlaceIds: new Set(),
        placeRevisions,
        dryRun: true,
        stats: emptyStats(),
      })

      enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
        (place) => place.title
      )
    })

    it("should leave it enabled", () => {
      expect(enabledTitles).toEqual(["Dry Run Scene"])
    })
  })
})
