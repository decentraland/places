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

/**
 * The worlds content server replaces every scene overlapping a deployment's footprint
 * without publishing an undeployment event for them, so those removals reach places
 * only as part of the deployment that caused them. A deployment discarded as superseded
 * must therefore still apply them, or the replaced scenes stay behind as places that no
 * longer exist upstream.
 */
describe("when a superseded world deployment replaced other scenes upstream", () => {
  let firstDeployedAt: number
  let supersededDeployedAt: number
  let newerDeployedAt: number

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
    // Day-scale gaps: deployed_at is a `timestamp without time zone`, so a stored
    // date read back into JS is shifted by the process UTC offset. Staleness is
    // decided in JS, so minute-scale gaps would make these tests depend on TZ.
    const day = 24 * 60 * 60 * 1000
    firstDeployedAt = Date.now() - 3 * day
    supersededDeployedAt = Date.now() - 2 * day
    newerDeployedAt = Date.now() - day
  })

  describe("and a newer deployment for one of those scenes was delivered first", () => {
    const worldName = "superseded-stale.dcl.eth"
    let enabledTitles: string[]

    beforeEach(async () => {
      // Two independent scenes, one parcel each
      await deliverDeployment({
        worldName,
        entityId: "entity-replaced",
        timestamp: firstDeployedAt,
        title: "Replaced Scene",
        base: "0,0",
        parcels: ["0,0"],
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-neighbour",
        timestamp: firstDeployedAt,
        title: "Original Neighbour",
        base: "1,0",
        parcels: ["1,0"],
      })

      // Delivered first: replaces the neighbour on 1,0 and never touches 0,0
      await deliverDeployment({
        worldName,
        entityId: "entity-newer",
        timestamp: newerDeployedAt,
        title: "Newer Scene",
        base: "1,0",
        parcels: ["1,0"],
      })

      // Delivered last: upstream this spanned both parcels and replaced both scenes
      // at its own timestamp, before the newer scene took 1,0 back
      await deliverDeployment({
        worldName,
        entityId: "entity-superseding",
        timestamp: supersededDeployedAt,
        title: "Superseding Scene",
        base: "0,0",
        parcels: ["0,0", "1,0"],
      })

      // SQS is at-least-once: replay the deployment that was retired upstream after its active
      // row has been disabled. Its replacement watermark must keep it from being resurrected.
      await deliverDeployment({
        worldName,
        entityId: "entity-replaced",
        timestamp: firstDeployedAt,
        title: "Replaced Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      const enabled = await PlaceModel.findEnabledWorldName(worldName)
      enabledTitles = enabled.map((place) => place.title as string)
    })

    it("should disable the place the superseded deployment had replaced", () => {
      expect(enabledTitles).not.toContain("Replaced Scene")
    })

    it("should keep the scene deployed after it active", () => {
      expect(enabledTitles).toContain("Newer Scene")
    })

    it("should not create a place for the superseded deployment", () => {
      expect(enabledTitles).not.toContain("Superseding Scene")
    })

    it("should leave only the scene that is still deployed upstream", () => {
      expect(enabledTitles).toHaveLength(1)
    })
  })

  describe("and the superseded deployment was discarded by a scene undeployment watermark", () => {
    const worldName = "superseded-watermark.dcl.eth"
    let enabledTitles: string[]

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-replaced",
        timestamp: firstDeployedAt,
        title: "Replaced Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      // The scene that replaced it upstream was then explicitly deleted
      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [{ entityId: "entity-superseding", baseParcel: "1,0" }],
          { timestamp: newerDeployedAt }
        )
      )

      // Its deployment message only arrives now, after the delete that retired it
      await deliverDeployment({
        worldName,
        entityId: "entity-superseding",
        timestamp: supersededDeployedAt,
        title: "Superseding Scene",
        base: "1,0",
        parcels: ["0,0", "1,0"],
      })

      const enabled = await PlaceModel.findEnabledWorldName(worldName)
      enabledTitles = enabled.map((place) => place.title as string)
    })

    it("should disable the place the superseded deployment had replaced", () => {
      expect(enabledTitles).not.toContain("Replaced Scene")
    })

    it("should leave the world without enabled places", () => {
      expect(enabledTitles).toHaveLength(0)
    })
  })

  describe("and every overlapping scene was deployed after it", () => {
    const worldName = "superseded-no-older.dcl.eth"
    let enabledTitles: string[]

    beforeEach(async () => {
      // Deployed after the superseded deployment, so it survived it upstream
      await deliverDeployment({
        worldName,
        entityId: "entity-newer",
        timestamp: newerDeployedAt,
        title: "Newer Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      await deliverDeployment({
        worldName,
        entityId: "entity-superseding",
        timestamp: supersededDeployedAt,
        title: "Superseding Scene",
        base: "0,0",
        parcels: ["0,0"],
      })

      const enabled = await PlaceModel.findEnabledWorldName(worldName)
      enabledTitles = enabled.map((place) => place.title as string)
    })

    it("should keep the newer overlapping scene active", () => {
      expect(enabledTitles).toEqual(["Newer Scene"])
    })
  })
})
