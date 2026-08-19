import { SQL } from "decentraland-gatsby/dist/entities/Database/utils"

import {
  ServedScene,
  WorldRepair,
  repairWorld,
} from "../../bin/repairUndeployedWorldPlaces"
import { DeploymentToSqs } from "../../src/entities/CheckScenes/task/consumer"
import { extractSceneJsonData } from "../../src/entities/CheckScenes/task/extractSceneJsonData"
import { handleWorldScenesUndeployment } from "../../src/entities/CheckScenes/task/handleWorldScenesUndeployment"
import { processEntityId } from "../../src/entities/CheckScenes/task/processEntityId"
import { taskRunnerSqs } from "../../src/entities/CheckScenes/task/taskRunnerSqs"
import PlaceModel from "../../src/entities/Place/model"
import WorldDeploymentPositionWatermarkModel from "../../src/entities/WorldDeploymentPositionWatermark/model"
import WorldSceneUndeploymentModel from "../../src/entities/WorldSceneUndeployment/model"
import WorldUndeploymentModel from "../../src/entities/WorldUndeployment/model"
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

function servedScene(options: {
  entityId: string
  base: string
  parcels?: string[]
  deployedAt: number
}): ServedScene {
  return {
    entityId: options.entityId,
    base: options.base,
    parcels: options.parcels ?? [options.base],
    deployedAt: new Date(options.deployedAt),
  }
}

/**
 * The repair undoes places that an undeployment disabled while the content server was still serving
 * their scene. Its whole job is to be conservative about what it re-enables and about which durable
 * records it touches, so these cover the states it must not produce as closely as the ones it must.
 */
describe("when repairing places an undeployment disabled", () => {
  const day = 24 * 60 * 60 * 1000
  let removedAt: number
  let servedAt: number
  let eventAt: number

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
    removedAt = Date.now() - 3 * day
    servedAt = Date.now() - 2 * day
    eventAt = Date.now() - day
  })

  describe("and the world still serves the disabled place's deployment", () => {
    const worldName = "repair-identity.dcl.eth"
    let repair: WorldRepair
    let place: { title: string | null; disabled: boolean } | null

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-served",
        timestamp: servedAt,
        title: "Served Scene",
        base: "0,0",
        parcels: ["0,0"],
      })
      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [{ entityId: "entity-served", baseParcel: "0,0" }],
          { timestamp: eventAt }
        )
      )

      repair = await repairWorld(
        worldName,
        [
          servedScene({
            entityId: "entity-served",
            base: "0,0",
            deployedAt: servedAt,
          }),
        ],
        false
      )
      place = await PlaceModel.namedQuery<{
        title: string | null
        disabled: boolean
      }>(
        "read_place",
        SQL`SELECT "title", "disabled" FROM places WHERE "deployment_id" = ${"entity-served"}`
      ).then((rows) => rows[0] ?? null)
    })

    it("should re-enable it by identity", () => {
      expect(place).toEqual({ title: "Served Scene", disabled: false })
    })

    it("should delete the tombstone the content server contradicts", async () => {
      const rows = await WorldSceneUndeploymentModel.namedQuery(
        "read_scene_watermarks",
        SQL`SELECT * FROM world_scene_undeployments WHERE "world_id" = ${worldName}`
      )

      expect(rows).toEqual([])
    })

    it("should report it as re-enabled by identity", () => {
      expect(repair.reenabledByIdentity).toHaveLength(1)
    })
  })

  describe("and an enabled place already covers that scene", () => {
    const worldName = "repair-duplicate.dcl.eth"
    let enabledCount: number

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-dup",
        timestamp: servedAt,
        title: "Original",
        base: "0,0",
        parcels: ["0,0"],
      })
      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [{ entityId: "entity-dup", baseParcel: "0,0" }],
          { timestamp: eventAt }
        )
      )
      // the ingestion path does not reuse a row disabled as an undeployment, so it creates a new one
      await deliverDeployment({
        worldName,
        entityId: "entity-dup-new",
        timestamp: Date.now(),
        title: "Recreated",
        base: "0,0",
        parcels: ["0,0"],
      })

      await repairWorld(
        worldName,
        [
          servedScene({
            entityId: "entity-dup",
            base: "0,0",
            deployedAt: servedAt,
          }),
        ],
        false
      )
      enabledCount = (await PlaceModel.findEnabledWorldName(worldName)).length
    })

    it("should not leave two enabled places at one base", () => {
      expect(enabledCount).toBe(1)
    })
  })

  describe("and a tombstone's base is occupied by a served scene", () => {
    const worldName = "repair-disarm.dcl.eth"
    let watermark: {
      deployment_id: string
      base_position_rejects: boolean
    } | null

    beforeEach(async () => {
      await WorldSceneUndeploymentModel.recordScenes(worldName, [
        {
          entityId: "entity-removed",
          baseParcel: "0,0",
          undeployedAt: new Date(eventAt),
          basePositionRejects: true,
        },
      ])

      await repairWorld(
        worldName,
        [
          servedScene({
            entityId: "entity-live",
            base: "0,0",
            deployedAt: servedAt,
          }),
        ],
        false
      )
      watermark = await WorldSceneUndeploymentModel.namedQuery<{
        deployment_id: string
        base_position_rejects: boolean
      }>(
        "read_watermark",
        SQL`SELECT "deployment_id", "base_position_rejects" FROM world_scene_undeployments WHERE "world_id" = ${worldName}`
      ).then((rows) => rows[0] ?? null)
    })

    it("should keep the tombstone rather than forget the removal", () => {
      expect(watermark?.deployment_id).toBe("entity-removed")
    })

    it("should stop it rejecting the base the served scene occupies", () => {
      expect(watermark?.base_position_rejects).toBe(false)
    })
  })

  describe("and a position watermark never rejected the served scene", () => {
    const worldName = "repair-position.dcl.eth"
    let remaining: string[]

    beforeEach(async () => {
      // a deployment records its own positions at its own timestamp, exclusive: it never rejected
      // itself, so the repair must leave it alone
      await WorldDeploymentPositionWatermarkModel.recordPositions(
        worldName,
        ["0,0"],
        new Date(servedAt),
        false
      )
      // an undeployment records them inclusive and later: this one does reject the served scene
      await WorldDeploymentPositionWatermarkModel.recordPositions(
        worldName,
        ["5,5"],
        new Date(eventAt),
        true
      )

      await repairWorld(
        worldName,
        [
          servedScene({
            entityId: "entity-live",
            base: "0,0",
            parcels: ["0,0", "5,5"],
            deployedAt: servedAt,
          }),
        ],
        false
      )
      remaining = (
        await WorldDeploymentPositionWatermarkModel.namedQuery<{
          position: string
        }>(
          "read_positions",
          SQL`SELECT "position" FROM world_deployment_position_watermarks WHERE "world_id" = ${worldName} ORDER BY "position"`
        )
      ).map((row) => row.position)
    })

    it("should delete only the watermark that rejects the served scene", () => {
      expect(remaining).toEqual(["0,0"])
    })
  })

  describe("and a full world watermark predates every served scene", () => {
    const worldName = "repair-world-watermark.dcl.eth"
    let remaining: number

    beforeEach(async () => {
      await WorldUndeploymentModel.recordWatermark(worldName, removedAt)

      await repairWorld(
        worldName,
        [
          servedScene({
            entityId: "entity-live",
            base: "0,0",
            deployedAt: servedAt,
          }),
        ],
        false
      )
      remaining = (
        await WorldUndeploymentModel.namedQuery(
          "read_world_watermark",
          SQL`SELECT * FROM world_undeployments WHERE "world_id" = ${worldName}`
        )
      ).length
    })

    it("should keep it, since it cannot reject that scene", () => {
      expect(remaining).toBe(1)
    })
  })

  describe("and a full world watermark reaches a served scene", () => {
    const worldName = "repair-world-watermark-blocking.dcl.eth"
    let remaining: number

    beforeEach(async () => {
      await WorldUndeploymentModel.recordWatermark(worldName, eventAt)

      await repairWorld(
        worldName,
        [
          servedScene({
            entityId: "entity-live",
            base: "0,0",
            deployedAt: servedAt,
          }),
        ],
        false
      )
      remaining = (
        await WorldUndeploymentModel.namedQuery(
          "read_world_watermark",
          SQL`SELECT * FROM world_undeployments WHERE "world_id" = ${worldName}`
        )
      ).length
    })

    it("should delete it, since it rejects that scene", () => {
      expect(remaining).toBe(0)
    })
  })

  describe("and the run is a dry run", () => {
    const worldName = "repair-dry-run.dcl.eth"
    let repair: WorldRepair
    let stillDisabled: boolean

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-dry",
        timestamp: servedAt,
        title: "Dry Run Scene",
        base: "0,0",
        parcels: ["0,0"],
      })
      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [{ entityId: "entity-dry", baseParcel: "0,0" }],
          { timestamp: eventAt }
        )
      )

      repair = await repairWorld(
        worldName,
        [
          servedScene({
            entityId: "entity-dry",
            base: "0,0",
            deployedAt: servedAt,
          }),
        ],
        true
      )
      stillDisabled =
        (await PlaceModel.findEnabledWorldName(worldName)).length === 0
    })

    it("should report what it would have re-enabled", () => {
      expect(repair.reenabledByIdentity).toHaveLength(1)
    })

    it("should roll the change back", () => {
      expect(stillDisabled).toBe(true)
    })
  })

  describe("and the disabled place's scene is genuinely gone", () => {
    const worldName = "repair-gone.dcl.eth"
    let repair: WorldRepair
    let enabled: number

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-gone",
        timestamp: servedAt,
        title: "Gone Scene",
        base: "0,0",
        parcels: ["0,0"],
      })
      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [{ entityId: "entity-gone", baseParcel: "0,0" }],
          { timestamp: eventAt }
        )
      )

      repair = await repairWorld(worldName, [], false)
      enabled = (await PlaceModel.findEnabledWorldName(worldName)).length
    })

    it("should leave it disabled", () => {
      expect(enabled).toBe(0)
    })

    it("should report nothing re-enabled", () => {
      expect(repair.reenabledByIdentity).toHaveLength(0)
    })

    it("should touch no watermark for a world that serves nothing", () => {
      expect(repair.sceneWatermarksCleared).toBe(0)
    })
  })
})
