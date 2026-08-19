import { SQL } from "decentraland-gatsby/dist/entities/Database/utils"
import logger from "decentraland-gatsby/dist/entities/Development/logger"

import {
  disableOrphanPlaces,
  readPlaceRevisions,
  rebuildWorld,
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

/**
 * The completeness rule that decides whether the sweep may run at all. Both mistakes found in it so
 * far were about which scenes count as accounted for, so it is asserted here through the same entry
 * point the script uses rather than by reading the branch.
 */
describe("when deciding whether a world's places can be judged complete", () => {
  const BASE = "https://worlds-content-server.decentraland.org"
  const day = 24 * 60 * 60 * 1000
  let fetchMock: jest.SpyInstance
  let olderServedAt: number
  let newerLocalAt: number

  beforeAll(async () => {
    await initTestDb()
  })

  afterAll(async () => {
    await closeTestDb()
  })

  beforeEach(() => {
    fetchMock = jest.spyOn(global, "fetch")
    // Without this the auto-mock resolves undefined, processWorldScene throws on destructuring it, and
    // the scene counts as unaccounted for the wrong reason -- which would make these tests pass while
    // proving nothing about the rule they are here for.
    mockExtractSceneJsonData.mockResolvedValue({
      creator: null,
      runtimeVersion: null,
    })
    olderServedAt = Date.now() - 2 * day
    newerLocalAt = Date.now() - day
  })

  afterEach(async () => {
    await cleanTables()
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  function listing(worldName: string, entityId: string, timestamp: number) {
    const entity = createWorldContentEntityScene({
      worldName,
      title: "Served Scene",
      base: "0,0",
      parcels: ["0,0"],
    })
    entity.timestamp = timestamp
    return {
      ok: true,
      json: async () => ({
        total: 1,
        scenes: [
          {
            worldName,
            entityId,
            deployer: "0xdeployer",
            entity,
            parcels: ["0,0"],
            size: "1",
            createdAt: new Date(timestamp).toISOString(),
          },
        ],
      }),
    } as Response
  }

  describe("and a served scene is older than the place already standing at its parcels", () => {
    const worldName = "rebuild-stale-scene.dcl.eth"
    let result: Awaited<ReturnType<typeof rebuildWorld>>
    let stillEnabled: boolean | undefined
    let stats: ReturnType<typeof emptyStats>

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-newer-local",
        timestamp: newerLocalAt,
        title: "Newer Local",
        base: "0,0",
        parcels: ["0,0"],
      })
      fetchMock.mockResolvedValueOnce(
        listing(worldName, "entity-older-served", olderServedAt)
      )

      stats = emptyStats()
      result = await rebuildWorld({
        worldName,
        worldsContentServerUrl: BASE,
        dryRun: false,
        stats,
      })
      stillEnabled = await PlaceModel.namedQuery<{ disabled: boolean }>(
        "read_place",
        SQL`SELECT "disabled" FROM places WHERE "deployment_id" = ${"entity-newer-local"}`
      ).then((rows) => rows[0]?.disabled === false)
    })

    it("should count that scene as unaccounted for, since no place came of it", () => {
      expect(result.unaccountedScenes).toBe(1)
    })

    it("should have skipped it rather than failed on it, which counts the same and would prove nothing", () => {
      expect(stats).toMatchObject({ skipped: 1, errored: 0 })
    })

    it("should skip the sweep rather than judge the world against a listing that explains none of it", () => {
      expect(result.sweptOrphans).toBe(false)
    })

    it("should leave the newer place enabled", () => {
      expect(stillEnabled).toBe(true)
    })
  })

  describe("and the listing accounts for every place in the world", () => {
    const worldName = "rebuild-accounted.dcl.eth"
    let result: Awaited<ReturnType<typeof rebuildWorld>>

    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(
        listing(worldName, "entity-served", olderServedAt)
      )

      result = await rebuildWorld({
        worldName,
        worldsContentServerUrl: BASE,
        dryRun: false,
        stats: emptyStats(),
      })
    })

    it("should sweep, since nothing is unexplained", () => {
      expect(result.sweptOrphans).toBe(true)
    })
  })
})

/**
 * The sanitizer has its own unit tests; this covers the wiring, which is the part that was wrong twice.
 * A title reaches the operator's terminal through the orphan report, and that report is what an operator
 * reads before deciding a destructive run did the right thing.
 */
describe("when a place title reaches the orphan report", () => {
  const worldName = "rebuild-hostile-title.dcl.eth"
  const day = 24 * 60 * 60 * 1000
  let logged: string

  beforeAll(async () => {
    await initTestDb()
  })

  afterAll(async () => {
    await closeTestDb()
  })

  afterEach(async () => {
    await cleanTables()
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  beforeEach(async () => {
    await deliverDeployment({
      worldName,
      entityId: "entity-hostile",
      timestamp: Date.now() - day,
      title: "Fine",
      base: "0,0",
      parcels: ["0,0"],
    })
    // a title carrying an erase-line sequence and a forged summary line, as a deployment could set it
    await PlaceModel.namedQuery(
      "set_hostile_title",
      SQL`UPDATE places SET "title" = ${"\u001b[2K\r  Errored: 0"} WHERE "deployment_id" = ${"entity-hostile"}`
    )

    const lines: string[] = []
    jest.spyOn(logger, "log").mockImplementation((...args: unknown[]) => {
      lines.push(args.map((arg) => String(arg)).join(" "))
    })

    const worldId = worldName.toLowerCase()
    await disableOrphanPlaces({
      worldName,
      worldId,
      knownPlaceIds: new Set<string>(),
      placeRevisions: await readPlaceRevisions(worldId),
      dryRun: true,
      stats: emptyStats(),
    })
    logged = lines.join("\n")
  })

  it("should have reported that place, so this is covering a line that was printed", () => {
    expect(logged).toContain("Errored: 0")
  })

  it("should print no escape sequence", () => {
    expect(logged).not.toContain("\u001b")
  })

  it("should print no carriage return, which would rewrite the line it sits on", () => {
    expect(logged).not.toContain("\r")
  })
})
