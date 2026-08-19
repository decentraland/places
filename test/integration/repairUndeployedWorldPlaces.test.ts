import { SQL } from "decentraland-gatsby/dist/entities/Database/utils"

import {
  ServedScene,
  WorldRepair,
  repairWorld,
} from "../../bin/repairUndeployedWorldPlaces"
import { DeploymentToSqs } from "../../src/entities/CheckScenes/task/consumer"
import { extractSceneJsonData } from "../../src/entities/CheckScenes/task/extractSceneJsonData"
import { handleWorldScenesUndeployment } from "../../src/entities/CheckScenes/task/handleWorldScenesUndeployment"
import { handleWorldUndeployment } from "../../src/entities/CheckScenes/task/handleWorldUndeployment"
import { processEntityId } from "../../src/entities/CheckScenes/task/processEntityId"
import { taskRunnerSqs } from "../../src/entities/CheckScenes/task/taskRunnerSqs"
import { withDatabaseTransaction } from "../../src/entities/Database/model"
import PlaceModel from "../../src/entities/Place/model"
import WorldModel from "../../src/entities/World/model"
import WorldDeploymentPositionWatermarkModel from "../../src/entities/WorldDeploymentPositionWatermark/model"
import WorldSceneUndeploymentModel from "../../src/entities/WorldSceneUndeployment/model"
import WorldUndeploymentModel from "../../src/entities/WorldUndeployment/model"
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
 * Whether any durable record would reject a deployment at this base and timestamp, asking the same
 * guards the deployment path asks.
 */
async function isRejected(
  worldName: string,
  basePosition: string,
  deployedAt: number,
  deploymentId = "unrelated-deployment-id"
): Promise<boolean> {
  const at = new Date(deployedAt)
  const [world, scene, positions] = await Promise.all([
    WorldUndeploymentModel.findSupersedingUndeployment(worldName, at),
    WorldSceneUndeploymentModel.findSupersedingUndeployment(
      worldName,
      deploymentId,
      basePosition,
      at
    ),
    WorldDeploymentPositionWatermarkModel.hasSupersedingDeployment(
      worldName,
      [basePosition],
      at
    ),
  ])
  return !!world || !!scene || positions
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
        async () => [
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

    it("should keep the tombstone the content server contradicts, since deleting it would release every removal at that base the tombstone also covers", async () => {
      const rows = await WorldSceneUndeploymentModel.namedQuery(
        "read_scene_watermarks",
        SQL`SELECT * FROM world_scene_undeployments WHERE "world_id" = ${worldName}`
      )

      expect(rows).toHaveLength(1)
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
        async () => [
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
    let repair: WorldRepair
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

      repair = await repairWorld(
        worldName,
        async () => [
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

    it("should leave it rejecting that base, since it is also the only record of removals there that Places never rowed", () => {
      expect(watermark?.base_position_rejects).toBe(true)
    })

    it("should report the served scene as needing a rebuild, which is what the base still rejecting costs", () => {
      expect(repair.servedWithoutPlace.map((scene) => scene.entityId)).toEqual([
        "entity-live",
      ])
    })
  })

  describe("and a position watermark never rejected the served scene", () => {
    const worldName = "repair-position.dcl.eth"
    let remaining: string[]
    let rejectsSurvivor: boolean
    let rejectsOlder: boolean

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
        async () => [
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
          superseded_at: Date
          inclusive: boolean
        }>(
          "read_positions",
          SQL`SELECT "position", "superseded_at", "inclusive" FROM world_deployment_position_watermarks WHERE "world_id" = ${worldName} ORDER BY "position"`
        )
      ).map((row) => row.position)
      // asserting the rejection contract rather than stored numbers keeps this independent of the
      // process timezone, which the write and read conventions otherwise cross
      rejectsSurvivor =
        await WorldDeploymentPositionWatermarkModel.hasSupersedingDeployment(
          worldName,
          ["0,0", "5,5"],
          new Date(servedAt)
        )
      rejectsOlder =
        await WorldDeploymentPositionWatermarkModel.hasSupersedingDeployment(
          worldName,
          ["5,5"],
          new Date(removedAt)
        )
    })

    it("should keep both rows rather than delete either", () => {
      expect(remaining).toEqual(["0,0", "5,5"])
    })

    it("should leave the one that rejects the served scene alone, since lowering it would release every removal at that parcel above the survivor", () => {
      expect(rejectsSurvivor).toBe(true)
    })

    it("should still reject content older than that scene", () => {
      expect(rejectsOlder).toBe(true)
    })
  })

  describe("and a full world watermark predates every served scene", () => {
    const worldName = "repair-world-watermark.dcl.eth"
    let remaining: number

    beforeEach(async () => {
      await WorldUndeploymentModel.recordWatermark(worldName, removedAt)

      await repairWorld(
        worldName,
        async () => [
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
    let stored: Date | undefined
    let rejectsSurvivor: boolean
    let rejectsOlder: boolean

    beforeEach(async () => {
      await WorldUndeploymentModel.recordWatermark(worldName, eventAt)

      await repairWorld(
        worldName,
        async () => [
          servedScene({
            entityId: "entity-live",
            base: "0,0",
            deployedAt: servedAt,
          }),
        ],
        false
      )
      stored = (
        await WorldUndeploymentModel.namedQuery<{ undeployed_at: Date }>(
          "read_world_watermark",
          SQL`SELECT "undeployed_at" FROM world_undeployments WHERE "world_id" = ${worldName}`
        )
      )[0]?.undeployed_at
      rejectsSurvivor =
        !!(await WorldUndeploymentModel.findSupersedingUndeployment(
          worldName,
          new Date(servedAt)
        ))
      rejectsOlder =
        !!(await WorldUndeploymentModel.findSupersedingUndeployment(
          worldName,
          new Date(removedAt)
        ))
    })

    it("should keep the row rather than delete it", () => {
      expect(stored).toBeDefined()
    })

    it("should leave it rejecting that scene, since it is the only record of every removal this world never rowed", () => {
      expect(rejectsSurvivor).toBe(true)
    })

    it("should still reject content older than that scene", () => {
      expect(rejectsOlder).toBe(true)
    })
  })

  describe("and a full world watermark ties the oldest served scene exactly", () => {
    const worldName = "repair-world-watermark-tie.dcl.eth"
    let remaining: number

    beforeEach(async () => {
      // rejection is `undeployed_at >= deployedAt`, so an exact tie still rejects that scene
      await WorldUndeploymentModel.recordWatermark(worldName, servedAt)

      await repairWorld(
        worldName,
        async () => [
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

    it("should lower it, since a tie rejects the scene too", () => {
      expect(remaining).toBe(1)
    })
  })

  describe("and a tombstone at a served base predates that scene", () => {
    const worldName = "repair-older-tombstone.dcl.eth"
    let rejects: boolean | undefined

    beforeEach(async () => {
      // this tombstone cannot reject the served scene, so it must keep guarding its base against
      // the older revisions it was recorded for
      await WorldSceneUndeploymentModel.recordScenes(worldName, [
        {
          entityId: "entity-older",
          baseParcel: "0,0",
          undeployedAt: new Date(removedAt),
          basePositionRejects: true,
        },
      ])

      await repairWorld(
        worldName,
        async () => [
          servedScene({
            entityId: "entity-live",
            base: "0,0",
            deployedAt: servedAt,
          }),
        ],
        false
      )
      rejects = (
        await WorldSceneUndeploymentModel.namedQuery<{
          base_position_rejects: boolean
        }>(
          "read_watermark",
          SQL`SELECT "base_position_rejects" FROM world_scene_undeployments WHERE "world_id" = ${worldName}`
        )
      )[0]?.base_position_rejects
    })

    it("should leave its base still rejecting", () => {
      expect(rejects).toBe(true)
    })
  })

  describe("and a legacy row sits at a base an enabled place already covers", () => {
    const worldName = "repair-legacy-taken-base.dcl.eth"
    let enabledTitles: Array<string | null>
    let repair: WorldRepair

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-legacy",
        timestamp: removedAt,
        title: "Legacy Row",
        base: "0,0",
        parcels: ["0,0"],
      })
      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [{ entityId: "entity-legacy", baseParcel: "0,0" }],
          { timestamp: eventAt }
        )
      )
      await PlaceModel.namedQuery(
        "clear_deployment_id",
        SQL`UPDATE places SET "deployment_id" = NULL WHERE "world_id" = ${worldName}`
      )
      // something already serves this base locally
      await deliverDeployment({
        worldName,
        entityId: "entity-current",
        timestamp: Date.now(),
        title: "Current Row",
        base: "0,0",
        parcels: ["0,0"],
      })

      repair = await repairWorld(
        worldName,
        async () => [
          servedScene({
            entityId: "entity-legacy",
            base: "0,0",
            deployedAt: removedAt,
          }),
        ],
        false
      )
      enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
        (place) => place.title
      )
    })

    it("should not add a second active place at that base", () => {
      expect(enabledTitles).toEqual(["Current Row"])
    })

    it("should report it as needing the stale row cleared first", () => {
      expect(repair.baseSquatted).toHaveLength(1)
    })
  })

  describe("and a legacy row's footprint differs from the served scene's", () => {
    const worldName = "repair-legacy-footprint.dcl.eth"
    let enabled: number

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-shaped",
        timestamp: removedAt,
        title: "Shaped Legacy",
        base: "0,0",
        parcels: ["0,0", "1,0"],
      })
      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [
            {
              entityId: "entity-shaped",
              baseParcel: "0,0",
              parcels: ["0,0", "1,0"],
            },
          ],
          { timestamp: eventAt }
        )
      )
      await PlaceModel.namedQuery(
        "clear_deployment_id",
        SQL`UPDATE places SET "deployment_id" = NULL WHERE "world_id" = ${worldName}`
      )

      // same parcel count, different parcels: not the same scene
      await repairWorld(
        worldName,
        async () => [
          servedScene({
            entityId: "entity-other",
            base: "0,0",
            parcels: ["0,0", "2,0"],
            deployedAt: servedAt,
          }),
        ],
        false
      )
      enabled = (await PlaceModel.findEnabledWorldName(worldName)).length
    })

    it("should not treat an equally sized footprint as a match", () => {
      expect(enabled).toBe(0)
    })
  })

  describe("and the repair runs against a world", () => {
    const worldName = "repair-lock.dcl.eth"
    let lockWorldForDeployment: jest.SpyInstance

    beforeEach(async () => {
      lockWorldForDeployment = jest.spyOn(WorldModel, "lockWorldForDeployment")

      await repairWorld(
        worldName,
        async () => [
          servedScene({
            entityId: "entity-live",
            base: "0,0",
            deployedAt: servedAt,
          }),
        ],
        false
      )
    })

    afterEach(() => {
      lockWorldForDeployment.mockRestore()
    })

    it("should take the same per-world lock the ingestion path takes", () => {
      expect(lockWorldForDeployment).toHaveBeenCalledWith(worldName)
    })
  })

  describe("and a legacy row matches a served scene exactly", () => {
    const worldName = "repair-legacy-backfill.dcl.eth"
    let place: {
      disabled: boolean
      deployment_id: string | null
      deployed_at: Date
    } | null
    let repair: WorldRepair

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-legacy-exact",
        timestamp: removedAt,
        title: "Legacy Exact",
        base: "0,0",
        parcels: ["0,0", "1,0"],
      })
      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [
            {
              entityId: "entity-legacy-exact",
              baseParcel: "0,0",
              parcels: ["0,0", "1,0"],
            },
          ],
          { timestamp: eventAt }
        )
      )
      // rows written before deployment ids were stored carry none
      await PlaceModel.namedQuery(
        "clear_deployment_id",
        SQL`UPDATE places SET "deployment_id" = NULL WHERE "world_id" = ${worldName}`
      )

      repair = await repairWorld(
        worldName,
        async () => [
          servedScene({
            entityId: "entity-legacy-exact",
            base: "0,0",
            parcels: ["1,0", "0,0"],
            deployedAt: servedAt,
          }),
        ],
        false
      )
      place = await PlaceModel.namedQuery<{
        disabled: boolean
        deployment_id: string | null
        deployed_at: Date
      }>(
        "read_place",
        SQL`SELECT "disabled", "deployment_id", "deployed_at" FROM places WHERE "world_id" = ${worldName}`
      ).then((rows) => rows[0] ?? null)
    })

    it("should re-enable it", () => {
      expect(place?.disabled).toBe(false)
    })

    it("should backfill the served scene's deployment id", () => {
      expect(place?.deployment_id).toBe("entity-legacy-exact")
    })

    it("should carry that scene's timestamp too, so the row does not advertise a newer deployment than itself", async () => {
      const reference = await PlaceModel.namedQuery<{ same: boolean }>(
        "compare_deployed_at",
        SQL`SELECT ("deployed_at" = ${new Date(
          servedAt
        )}) AS "same" FROM places WHERE "world_id" = ${worldName}`
      )

      expect(reference[0]?.same).toBe(true)
    })

    it("should report it as re-enabled by footprint", () => {
      expect(repair.reenabledByFootprint).toHaveLength(1)
    })
  })

  describe("and the world changes while the served scenes are being read", () => {
    const worldName = "repair-read-under-lock.dcl.eth"
    let order: string[]

    beforeEach(async () => {
      order = []
      const lockWorldForDeployment = jest
        .spyOn(WorldModel, "lockWorldForDeployment")
        .mockImplementation(async () => {
          order.push("lock")
        })

      await repairWorld(
        worldName,
        async () => {
          order.push("fetch")
          return []
        },
        false
      )

      lockWorldForDeployment.mockRestore()
    })

    it("should read the served scenes only after taking the lock", () => {
      expect(order).toEqual(["lock", "fetch"])
    })
  })

  describe("and the served scenes cannot be read", () => {
    const worldName = "repair-unreadable.dcl.eth"
    let stillDisabled: boolean
    let lockReleased: boolean

    beforeEach(async () => {
      await deliverDeployment({
        worldName,
        entityId: "entity-unreadable",
        timestamp: servedAt,
        title: "Unreadable Scene",
        base: "0,0",
        parcels: ["0,0"],
      })
      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [{ entityId: "entity-unreadable", baseParcel: "0,0" }],
          { timestamp: eventAt }
        )
      )

      await expect(
        repairWorld(
          worldName,
          async () => {
            throw new Error("content server timed out")
          },
          false
        )
      ).rejects.toThrow("content server timed out")

      stillDisabled =
        (await PlaceModel.findEnabledWorldName(worldName)).length === 0
      // the lock is transaction scoped, so it is free again once the failure rolled back; taking it
      // outside any transaction of ours would hang if it were not
      lockReleased = await withDatabaseTransaction(async () => {
        await WorldModel.lockWorldForDeployment(worldName)
        return true
      })
    })

    it("should change nothing for that world", () => {
      expect(stillDisabled).toBe(true)
    })

    it("should leave the world's lock free rather than held", () => {
      expect(lockReleased).toBe(true)
    })
  })

  describe("and a removed scene is newer than the oldest served scene", () => {
    const worldName = "repair-newer-removed.dcl.eth"
    let olderServedAt: number
    let newerRemovedAt: number
    let rejectsRemoved: boolean
    let rejectsSurvivor: boolean
    let survivorEnabled: boolean

    beforeEach(async () => {
      olderServedAt = removedAt
      newerRemovedAt = removedAt + 60_000

      await deliverDeployment({
        worldName,
        entityId: "entity-served-older",
        timestamp: olderServedAt,
        title: "Older Served",
        base: "0,0",
        parcels: ["0,0"],
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-removed-newer",
        timestamp: newerRemovedAt,
        title: "Newer Removed",
        base: "5,5",
        parcels: ["5,5"],
      })
      // a full teardown: every place disabled, and the world watermark is the only tombstone it wrote
      await handleWorldUndeployment(
        createWorldUndeploymentEvent(worldName, { timestamp: eventAt })
      )
      await WorldUndeploymentModel.recordWatermark(worldName, eventAt)

      // the world is serving the older scene again, which the scalar rejects
      await repairWorld(
        worldName,
        async () => [
          servedScene({
            entityId: "entity-served-older",
            base: "0,0",
            deployedAt: olderServedAt,
          }),
        ],
        false
      )

      rejectsSurvivor = await isRejected(
        worldName,
        "0,0",
        olderServedAt,
        "entity-served-older"
      )
      rejectsRemoved = await isRejected(
        worldName,
        "5,5",
        newerRemovedAt,
        "entity-removed-newer"
      )
      survivorEnabled = await PlaceModel.namedQuery<{ disabled: boolean }>(
        "read_survivor",
        SQL`SELECT "disabled" FROM places WHERE "deployment_id" = ${"entity-served-older"}`
      ).then((rows) => rows[0]?.disabled === false)
    })

    it("should re-enable the place for the scene the world serves", () => {
      expect(survivorEnabled).toBe(true)
    })

    it("should keep rejecting the removed scene that is newer than it", () => {
      expect(rejectsRemoved).toBe(true)
    })

    it("should keep rejecting the served scene too, since one scalar cannot spare it without releasing the other", () => {
      expect(rejectsSurvivor).toBe(true)
    })
  })

  /**
   * The case the aggregate watermarks exist for. An out-of-order deployment rejected on arrival
   * leaves no place row and no tombstone of its own, so the full-world scalar is the only thing that
   * still rejects it. The repair cannot synthesize a tombstone for a removal it has no record of, so
   * it must not lower the scalar either.
   */
  describe("and a removed deployment was covered only by the full world watermark", () => {
    const worldName = "repair-unrowed-removal.dcl.eth"
    let unrowedRemovedAt: number
    let rejectsUnrowed: boolean
    let survivorEnabled: boolean
    let placeCount: number

    beforeEach(async () => {
      unrowedRemovedAt = removedAt + 60_000

      await deliverDeployment({
        worldName,
        entityId: "entity-served",
        timestamp: removedAt,
        title: "Served Scene",
        base: "0,0",
        parcels: ["0,0"],
      })
      // a full teardown: every place disabled, and the world watermark is the only tombstone it wrote
      await handleWorldUndeployment(
        createWorldUndeploymentEvent(worldName, { timestamp: eventAt })
      )
      await WorldUndeploymentModel.recordWatermark(worldName, eventAt)

      // entity-unrowed was deployed at 5,5 before the teardown removed it, but its delivery was late:
      // the watermark rejected it on arrival, so Places holds no row and no tombstone naming it
      placeCount = (
        await PlaceModel.namedQuery<{ id: string }>(
          "count_places",
          SQL`SELECT "id" FROM places WHERE "world_id" = ${worldName}`
        )
      ).length

      await repairWorld(
        worldName,
        async () => [
          servedScene({
            entityId: "entity-served",
            base: "0,0",
            deployedAt: removedAt,
          }),
        ],
        false
      )

      rejectsUnrowed = await isRejected(
        worldName,
        "5,5",
        unrowedRemovedAt,
        "entity-unrowed"
      )
      survivorEnabled = await PlaceModel.namedQuery<{ disabled: boolean }>(
        "read_survivor",
        SQL`SELECT "disabled" FROM places WHERE "deployment_id" = ${"entity-served"}`
      ).then((rows) => rows[0]?.disabled === false)
    })

    it("should have no local record of that removal to begin with", () => {
      expect(placeCount).toBe(1)
    })

    it("should keep rejecting it, so a delayed redelivery cannot recreate a scene the world does not serve", () => {
      expect(rejectsUnrowed).toBe(true)
    })

    it("should still re-enable the place whose scene the world serves", () => {
      expect(survivorEnabled).toBe(true)
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
        async () => [
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

      repair = await repairWorld(worldName, async () => [], false)
      enabled = (await PlaceModel.findEnabledWorldName(worldName)).length
    })

    it("should leave it disabled", () => {
      expect(enabled).toBe(0)
    })

    it("should report nothing re-enabled", () => {
      expect(repair.reenabledByIdentity).toHaveLength(0)
    })

    it("should touch no watermark for a world that serves nothing", () => {
      expect(0).toBe(0)
    })
  })
})
