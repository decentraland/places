import { randomUUID } from "crypto"

import { DeploymentToSqs } from "../../src/entities/CheckScenes/task/consumer"
import { InvalidWorldSqsMessageError } from "../../src/entities/CheckScenes/task/errors"
import { extractSceneJsonData } from "../../src/entities/CheckScenes/task/extractSceneJsonData"
import { handleWorldScenesUndeployment } from "../../src/entities/CheckScenes/task/handleWorldScenesUndeployment"
import { handleWorldUndeployment } from "../../src/entities/CheckScenes/task/handleWorldUndeployment"
import {
  fetchContentEntity,
  processEntityId,
} from "../../src/entities/CheckScenes/task/processEntityId"
import { taskRunnerSqs } from "../../src/entities/CheckScenes/task/taskRunnerSqs"
import PlaceModel from "../../src/entities/Place/model"
import { DisabledReason, PlaceAttributes } from "../../src/entities/Place/types"
import WorldDeploymentPositionWatermarkModel from "../../src/entities/WorldDeploymentPositionWatermark/model"
import WorldSceneUndeploymentModel from "../../src/entities/WorldSceneUndeployment/model"
import { WorldSceneUndeploymentAttributes } from "../../src/entities/WorldSceneUndeployment/types"
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
const mockFetchContentEntity = fetchContentEntity as jest.MockedFunction<
  typeof fetchContentEntity
>
const mockExtractSceneJsonData = extractSceneJsonData as jest.MockedFunction<
  typeof extractSceneJsonData
>

type DeploymentOptions = {
  worldName: string
  entityId: string
  timestamp: number
  title: string
  base: string
  parcels?: string[]
}

async function deliverDeployment({
  worldName,
  entityId,
  timestamp,
  title,
  base,
  parcels = [base],
}: DeploymentOptions): Promise<void> {
  const scene = createWorldContentEntityScene({
    worldName,
    title,
    base,
    parcels,
  })
  scene.timestamp = timestamp

  mockProcessEntityId.mockResolvedValueOnce(scene)
  mockExtractSceneJsonData.mockResolvedValueOnce({
    creator: null,
    runtimeVersion: null,
  })

  const message = createWorldDeploymentMessage()
  const job: DeploymentToSqs = {
    ...message,
    entity: { ...message.entity, entityId },
  }
  await taskRunnerSqs(job)
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined
  const promise = new Promise<void>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe("when deployments and undeployments arrive in adversarial orders", () => {
  beforeAll(async () => {
    await initTestDb()
  })

  afterAll(async () => {
    await closeTestDb()
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    await cleanTables()
  })

  describe("and one scene undeployment batch mixes older, newer, and absent scenes", () => {
    let state: {
      disabledReason: DisabledReason | null
      enabledTitles: Array<string | null>
      oldAbsentDeploymentRows: number
    }

    beforeEach(async () => {
      const worldName = "mixed-batch.dcl.eth"
      const eventTimestamp = Date.parse("2026-08-10T12:00:00.001Z")

      await deliverDeployment({
        worldName,
        entityId: "entity-mixed-old",
        timestamp: eventTimestamp - 1,
        title: "Old Existing Scene",
        base: "0,0",
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-mixed-new",
        timestamp: eventTimestamp + 1,
        title: "New Existing Scene",
        base: "1,0",
      })

      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [
            { entityId: "entity-mixed-old", baseParcel: "0,0" },
            { entityId: "entity-mixed-new", baseParcel: "1,0" },
            { entityId: "entity-mixed-absent", baseParcel: "2,0" },
          ],
          { timestamp: eventTimestamp }
        )
      )

      await deliverDeployment({
        worldName,
        entityId: "entity-mixed-absent",
        timestamp: eventTimestamp - 1,
        title: "Old Absent Scene",
        base: "2,0",
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-mixed-redeployment",
        timestamp: eventTimestamp + 2,
        title: "New Absent Scene",
        base: "2,0",
      })

      const oldPlace = await PlaceModel.findByWorldIdAndBasePosition(
        worldName,
        "0,0"
      )
      const enabled = await PlaceModel.findEnabledWorldName(worldName)
      const oldAbsentRows = await PlaceModel.find<PlaceAttributes>({
        deployment_id: "entity-mixed-absent",
      })
      state = {
        disabledReason: oldPlace?.disabled_reason ?? null,
        enabledTitles: enabled.map((place) => place.title).sort(),
        oldAbsentDeploymentRows: oldAbsentRows.length,
      }
    })

    it("should independently disable, preserve, reject, and accept each revision", () => {
      expect(state).toEqual({
        disabledReason: DisabledReason.UNDEPLOYMENT,
        enabledTitles: ["New Absent Scene", "New Existing Scene"],
        oldAbsentDeploymentRows: 0,
      })
    })
  })

  describe("and an undeployed replacement was never stored locally", () => {
    let state: {
      olderRevisionDisabledReason: DisabledReason | null
      enabledTitles: Array<string | null>
    }

    beforeEach(async () => {
      const worldName = "missing-replacement.dcl.eth"
      const olderDeploymentTimestamp = Date.parse("2026-08-10T12:30:00.000Z")
      const undeploymentTimestamp = olderDeploymentTimestamp + 2

      await deliverDeployment({
        worldName,
        entityId: "entity-older-revision",
        timestamp: olderDeploymentTimestamp,
        title: "Older Replaced Scene",
        base: "0,0",
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-unrelated-sibling",
        timestamp: olderDeploymentTimestamp,
        title: "Unrelated Sibling Scene",
        base: "5,5",
      })

      // The replacement deployment never reached Places, but its later undeployment still proves
      // that every older revision at its base was retired upstream.
      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [{ entityId: "entity-missing-replacement", baseParcel: "0,0" }],
          { timestamp: undeploymentTimestamp }
        )
      )

      const olderRevision = await PlaceModel.findByWorldIdAndBasePosition(
        worldName,
        "0,0"
      )
      state = {
        olderRevisionDisabledReason: olderRevision?.disabled_reason ?? null,
        enabledTitles: (await PlaceModel.findEnabledWorldName(worldName)).map(
          (place) => place.title
        ),
      }
    })

    it("should disable the older base revision while preserving unrelated scenes", () => {
      expect(state).toEqual({
        olderRevisionDisabledReason: DisabledReason.UNDEPLOYMENT,
        enabledTitles: ["Unrelated Sibling Scene"],
      })
    })
  })

  describe("and the missing replacement changed base while still overlapping the stored scene", () => {
    let state: {
      olderRevisionDisabledReason: DisabledReason | null
      enabledTitles: Array<string | null>
    }

    beforeEach(async () => {
      const worldName = "missing-reshaped-replacement.dcl.eth"
      const olderDeploymentTimestamp = Date.parse("2026-08-10T12:40:00.000Z")
      const undeploymentTimestamp = olderDeploymentTimestamp + 2

      await deliverDeployment({
        worldName,
        entityId: "entity-older-shaped-revision",
        timestamp: olderDeploymentTimestamp,
        title: "Older Shaped Scene",
        base: "0,0",
        parcels: ["0,0", "1,0"],
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-shaped-sibling",
        timestamp: olderDeploymentTimestamp,
        title: "Unrelated Shaped Sibling",
        base: "5,5",
      })

      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [
            {
              entityId: "entity-missing-reshaped-replacement",
              baseParcel: "1,0",
              parcels: ["1,0", "2,0"],
            },
          ],
          { timestamp: undeploymentTimestamp }
        )
      )

      const olderRevision = await PlaceModel.findByWorldIdAndBasePosition(
        worldName,
        "0,0"
      )
      state = {
        olderRevisionDisabledReason: olderRevision?.disabled_reason ?? null,
        enabledTitles: (await PlaceModel.findEnabledWorldName(worldName)).map(
          (place) => place.title
        ),
      }
    })

    it("should disable the older overlapping revision while preserving unrelated scenes", () => {
      expect(state).toEqual({
        olderRevisionDisabledReason: DisabledReason.UNDEPLOYMENT,
        enabledTitles: ["Unrelated Shaped Sibling"],
      })
    })
  })

  describe("and the older changed-base deployment arrives only after the replacement undeployment", () => {
    let enabledTitles: Array<string | null>

    beforeEach(async () => {
      const worldName = "late-reshaped-replacement.dcl.eth"
      const olderDeploymentTimestamp = Date.parse("2026-08-10T12:50:00.000Z")

      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [
            {
              entityId: "entity-late-reshaped-replacement",
              baseParcel: "1,0",
              parcels: ["1,0", "2,0"],
            },
          ],
          { timestamp: olderDeploymentTimestamp + 2 }
        )
      )
      await deliverDeployment({
        worldName,
        entityId: "entity-late-older-shape",
        timestamp: olderDeploymentTimestamp,
        title: "Late Older Shape",
        base: "0,0",
        parcels: ["0,0", "1,0"],
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-late-unrelated-shape",
        timestamp: olderDeploymentTimestamp,
        title: "Late Unrelated Shape",
        base: "5,5",
      })

      enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
        (place) => place.title
      )
    })

    it("should reject only the delayed deployment overlapping the retired footprint", () => {
      expect(enabledTitles).toEqual(["Late Unrelated Shape"])
    })
  })

  describe("and an oversized replacement footprint must be fetched", () => {
    let state: { enabledTitles: Array<string | null>; fetchCount: number }

    beforeEach(async () => {
      const worldName = "fetched-reshaped-replacement.dcl.eth"
      const olderDeploymentTimestamp = Date.parse("2026-08-10T12:55:00.000Z")
      mockFetchContentEntity.mockResolvedValueOnce(
        createWorldContentEntityScene({
          worldName,
          base: "1,0",
          parcels: ["1,0", "2,0"],
        })
      )

      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [
            {
              entityId: "entity-oversized-replacement",
              baseParcel: "1,0",
            },
          ],
          {
            timestamp: olderDeploymentTimestamp + 2,
            includeParcels: false,
          }
        )
      )
      await deliverDeployment({
        worldName,
        entityId: "entity-before-oversized-replacement",
        timestamp: olderDeploymentTimestamp,
        title: "Older Scene Before Oversized Replacement",
        base: "0,0",
        parcels: ["0,0", "1,0"],
      })

      state = {
        enabledTitles: (await PlaceModel.findEnabledWorldName(worldName)).map(
          (place) => place.title
        ),
        fetchCount: mockFetchContentEntity.mock.calls.length,
      }
    })

    it("should fetch the footprint and reject the delayed overlapping deployment", () => {
      expect(state).toEqual({ enabledTitles: [], fetchCount: 1 })
    })
  })

  describe("and a changed-base deployment ties the replacement undeployment timestamp", () => {
    let enabledTitles: Array<string | null>

    beforeEach(async () => {
      const worldName = "tied-reshaped-undeployment.dcl.eth"
      const boundaryTimestamp = Date.parse("2026-08-10T12:57:00.000Z")

      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [
            {
              entityId: "entity-tied-reshaped-replacement",
              baseParcel: "1,0",
              parcels: ["1,0", "2,0"],
            },
          ],
          { timestamp: boundaryTimestamp }
        )
      )
      await deliverDeployment({
        worldName,
        entityId: "entity-tied-older-shape",
        timestamp: boundaryTimestamp,
        title: "Tied Older Shape",
        base: "0,0",
        parcels: ["0,0", "1,0"],
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-after-shaped-undeployment",
        timestamp: boundaryTimestamp + 1,
        title: "After Shaped Undeployment",
        base: "0,0",
        parcels: ["0,0", "1,0"],
      })

      enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
        (place) => place.title
      )
    })

    it("should reject the tied deployment while accepting the strictly newer one", () => {
      expect(enabledTitles).toEqual(["After Shaped Undeployment"])
    })
  })

  describe("and a stale scene undeployment is followed by older and newer deliveries", () => {
    let enabledTitles: Array<string | null>

    beforeEach(async () => {
      const worldName = "stale-scene-followups.dcl.eth"
      const eventTimestamp = Date.parse("2026-08-10T13:00:00.000Z")

      await deliverDeployment({
        worldName,
        entityId: "entity-current",
        timestamp: eventTimestamp + 1,
        title: "Current Scene",
        base: "0,0",
      })
      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [{ entityId: "entity-current", baseParcel: "0,0" }],
          { timestamp: eventTimestamp }
        )
      )
      await deliverDeployment({
        worldName,
        entityId: "entity-before-event",
        timestamp: eventTimestamp - 1,
        title: "Rejected Older Scene",
        base: "0,0",
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-after-event",
        timestamp: eventTimestamp + 2,
        title: "Accepted Newer Scene",
        base: "0,0",
      })

      enabledTitles = (await PlaceModel.findEnabledWorldName(worldName)).map(
        (place) => place.title
      )
    })

    it("should keep the newest post-event deployment without admitting the older replay", () => {
      expect(enabledTitles).toEqual(["Accepted Newer Scene"])
    })
  })

  describe("and a stale world undeployment is followed by older and newer deliveries", () => {
    let enabledTitles: Array<string | null>

    beforeEach(async () => {
      const worldName = "stale-world-followups.dcl.eth"
      const eventTimestamp = Date.parse("2026-08-10T14:00:00.000Z")

      await deliverDeployment({
        worldName,
        entityId: "entity-world-current",
        timestamp: eventTimestamp + 1,
        title: "Current World Scene",
        base: "0,0",
      })
      await handleWorldUndeployment(
        createWorldUndeploymentEvent(worldName, {
          timestamp: eventTimestamp,
        })
      )
      await deliverDeployment({
        worldName,
        entityId: "entity-world-before",
        timestamp: eventTimestamp - 1,
        title: "Rejected World Scene",
        base: "1,0",
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-world-after",
        timestamp: eventTimestamp + 2,
        title: "Accepted World Scene",
        base: "2,0",
      })

      enabledTitles = (await PlaceModel.findEnabledWorldName(worldName))
        .map((place) => place.title)
        .sort()
    })

    it("should preserve existing newer content and accept only post-event deliveries", () => {
      expect(enabledTitles).toEqual([
        "Accepted World Scene",
        "Current World Scene",
      ])
    })
  })

  describe("and scene undeployment persistence fails after disabling its place", () => {
    let state: {
      enabledTitles: Array<string | null>
      errorMessage: string | null
      positionWatermarkExists: boolean
      watermark: WorldSceneUndeploymentAttributes | null
    }

    beforeEach(async () => {
      const worldName = "scene-rollback.dcl.eth"
      const deployedAt = Date.parse("2026-08-10T15:00:00.000Z")
      await deliverDeployment({
        worldName,
        entityId: "entity-scene-rollback",
        timestamp: deployedAt,
        title: "Rollback Scene",
        base: "0,0",
      })

      const disable = PlaceModel.disableByWorldIdAndDeployments.bind(PlaceModel)
      jest
        .spyOn(PlaceModel, "disableByWorldIdAndDeployments")
        .mockImplementationOnce(async (...args) => {
          await disable(...args)
          throw new Error("scene disable failed")
        })

      const error = await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [{ entityId: "entity-scene-rollback", baseParcel: "0,0" }],
          { timestamp: deployedAt + 1 }
        )
      ).then(
        () => null,
        (reason: unknown) => reason
      )
      const watermark =
        await WorldSceneUndeploymentModel.findSupersedingUndeployment(
          worldName,
          "entity-scene-rollback",
          "0,0",
          new Date(deployedAt)
        )
      const positionWatermarkExists =
        await WorldDeploymentPositionWatermarkModel.hasSupersedingDeployment(
          worldName,
          ["0,0"],
          new Date(deployedAt)
        )
      state = {
        enabledTitles: (await PlaceModel.findEnabledWorldName(worldName)).map(
          (place) => place.title
        ),
        errorMessage: error instanceof Error ? error.message : null,
        positionWatermarkExists,
        watermark,
      }
    })

    it("should roll back both the disable and its watermark", () => {
      expect(state).toEqual({
        enabledTitles: ["Rollback Scene"],
        errorMessage: "scene disable failed",
        positionWatermarkExists: false,
        watermark: null,
      })
    })
  })

  describe("and world undeployment persistence fails after disabling its places", () => {
    let state: {
      enabledTitles: Array<string | null>
      errorMessage: string | null
      watermarkExists: boolean
    }

    beforeEach(async () => {
      const worldName = "world-rollback.dcl.eth"
      const deployedAt = Date.parse("2026-08-10T16:00:00.000Z")
      await deliverDeployment({
        worldName,
        entityId: "entity-world-rollback",
        timestamp: deployedAt,
        title: "Rollback World Scene",
        base: "0,0",
      })

      const disable = PlaceModel.disableByWorldId.bind(PlaceModel)
      jest
        .spyOn(PlaceModel, "disableByWorldId")
        .mockImplementationOnce(async (...args) => {
          await disable(...args)
          throw new Error("world disable failed")
        })

      const error = await handleWorldUndeployment(
        createWorldUndeploymentEvent(worldName, {
          timestamp: deployedAt + 1,
        })
      ).then(
        () => null,
        (reason: unknown) => reason
      )
      const watermark =
        await WorldUndeploymentModel.findSupersedingUndeployment(
          worldName,
          new Date(deployedAt)
        )
      state = {
        enabledTitles: (await PlaceModel.findEnabledWorldName(worldName)).map(
          (place) => place.title
        ),
        errorMessage: error instanceof Error ? error.message : null,
        watermarkExists: watermark !== null,
      }
    })

    it("should roll back both the disables and the world watermark", () => {
      expect(state).toEqual({
        enabledTitles: ["Rollback World Scene"],
        errorMessage: "world disable failed",
        watermarkExists: false,
      })
    })
  })

  describe("and a world undeployment races an in-flight deployment", () => {
    let disabledState: {
      disabled: boolean | undefined
      reason: DisabledReason | null | undefined
    }

    beforeEach(async () => {
      const worldName = "concurrent-world-undeployment.dcl.eth"
      const deployedAt = Date.parse("2026-08-10T17:00:00.000Z")
      const deploymentInserted = deferred()
      const releaseDeployment = deferred()
      const insertPlace = PlaceModel.insertPlace.bind(PlaceModel)
      jest
        .spyOn(PlaceModel, "insertPlace")
        .mockImplementationOnce(async (...args) => {
          const result = await insertPlace(...args)
          deploymentInserted.resolve()
          await releaseDeployment.promise
          return result
        })

      const deployment = deliverDeployment({
        worldName,
        entityId: "entity-concurrent-world",
        timestamp: deployedAt,
        title: "Concurrent World Scene",
        base: "0,0",
      })
      await deploymentInserted.promise
      const undeployment = handleWorldUndeployment(
        createWorldUndeploymentEvent(worldName, {
          timestamp: deployedAt + 1,
        })
      )
      await new Promise((resolve) => setTimeout(resolve, 100))
      releaseDeployment.resolve()
      await Promise.all([deployment, undeployment])

      const place = await PlaceModel.findByWorldIdAndBasePosition(
        worldName,
        "0,0"
      )
      disabledState = {
        disabled: place?.disabled,
        reason: place?.disabled_reason,
      }
    })

    it("should serialize the events and leave the committed place undeployed", () => {
      expect(disabledState).toEqual({
        disabled: true,
        reason: DisabledReason.UNDEPLOYMENT,
      })
    })
  })

  describe("and scene undeployments are duplicated and reordered", () => {
    let enabledCount: number

    beforeEach(async () => {
      const worldName = "reordered-scene-events.dcl.eth"
      const firstTimestamp = Date.parse("2026-08-10T18:00:00.000Z")
      const firstEvent = createWorldScenesUndeploymentEvent(
        worldName,
        [{ entityId: "entity-reordered-scene", baseParcel: "0,0" }],
        { timestamp: firstTimestamp }
      )
      await handleWorldScenesUndeployment(firstEvent)
      await handleWorldScenesUndeployment(firstEvent)
      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [{ entityId: "entity-reordered-scene", baseParcel: "0,0" }],
          { timestamp: firstTimestamp + 2 }
        )
      )
      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [{ entityId: "entity-reordered-scene", baseParcel: "0,0" }],
          { timestamp: firstTimestamp - 1 }
        )
      )
      await deliverDeployment({
        worldName,
        entityId: "entity-between-scene-events",
        timestamp: firstTimestamp + 1,
        title: "Rejected Between Scene Events",
        base: "0,0",
      })

      enabledCount = (await PlaceModel.findEnabledWorldName(worldName)).length
    })

    it("should stay idempotent and retain the newest event boundary", () => {
      expect(enabledCount).toBe(0)
    })
  })

  describe("and world undeployments are duplicated and reordered", () => {
    let enabledCount: number

    beforeEach(async () => {
      const worldName = "reordered-world-events.dcl.eth"
      const firstTimestamp = Date.parse("2026-08-10T19:00:00.000Z")
      const firstEvent = createWorldUndeploymentEvent(worldName, {
        timestamp: firstTimestamp,
      })
      await handleWorldUndeployment(firstEvent)
      await handleWorldUndeployment(firstEvent)
      await handleWorldUndeployment(
        createWorldUndeploymentEvent(worldName, {
          timestamp: firstTimestamp + 2,
        })
      )
      await handleWorldUndeployment(
        createWorldUndeploymentEvent(worldName, {
          timestamp: firstTimestamp - 1,
        })
      )
      await deliverDeployment({
        worldName,
        entityId: "entity-between-world-events",
        timestamp: firstTimestamp + 1,
        title: "Rejected Between World Events",
        base: "5,0",
      })

      enabledCount = (await PlaceModel.findEnabledWorldName(worldName)).length
    })

    it("should stay idempotent and retain the newest world boundary", () => {
      expect(enabledCount).toBe(0)
    })
  })

  describe("and a large scene undeployment event repeats one scene", () => {
    let recordedScenes: number

    beforeEach(async () => {
      const worldName = "large-undeployment.dcl.eth"
      const scenes = Array.from({ length: 2_000 }, (_, index) => ({
        entityId: `entity-large-${index}`,
        baseParcel: `${index},0`,
      }))
      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(worldName, [...scenes, scenes[0]], {
          timestamp: Date.parse("2026-08-10T20:00:00.000Z"),
        })
      )
      recordedScenes = (
        await WorldSceneUndeploymentModel.find<WorldSceneUndeploymentAttributes>(
          { world_id: worldName }
        )
      ).length
    })

    it("should persist every unique scene in one scalable batch", () => {
      expect(recordedScenes).toBe(2_000)
    })
  })

  describe("and an undeployment batch repeats one deployment with conflicting bases", () => {
    let state: {
      enabledTitles: Array<string | null>
      errorIsDeterministic: boolean
      recordedWatermarks: number
    }

    beforeEach(async () => {
      const worldName = "invalid-bulk-event.dcl.eth"
      const deployedAt = Date.parse("2026-08-10T21:00:00.000Z")
      await deliverDeployment({
        worldName,
        entityId: "entity-invalid-batch",
        timestamp: deployedAt,
        title: "Preserved Scene",
        base: "0,0",
      })
      const error = await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [
            { entityId: "entity-invalid-batch", baseParcel: "0,0" },
            { entityId: "entity-invalid-batch", baseParcel: "1,0" },
          ],
          { timestamp: deployedAt + 1 }
        )
      ).then(
        () => null,
        (reason: unknown) => reason
      )

      state = {
        enabledTitles: (await PlaceModel.findEnabledWorldName(worldName)).map(
          (place) => place.title
        ),
        errorIsDeterministic: error instanceof InvalidWorldSqsMessageError,
        recordedWatermarks: (
          await WorldSceneUndeploymentModel.find<WorldSceneUndeploymentAttributes>(
            { world_id: worldName }
          )
        ).length,
      }
    })

    it("should reject the entire batch without changing durable state", () => {
      expect(state).toEqual({
        enabledTitles: ["Preserved Scene"],
        errorIsDeterministic: true,
        recordedWatermarks: 0,
      })
    })
  })

  describe("and overlapping deployments carry the same timestamp", () => {
    let state: {
      activeCount: number
      deploymentId: string | null
      title: string | null
    }

    beforeEach(async () => {
      const worldName = "equal-deployments.dcl.eth"
      const sharedTimestamp = Date.parse("2026-08-10T22:00:00.000Z")
      await deliverDeployment({
        worldName,
        entityId: "entity-equal-a",
        timestamp: sharedTimestamp,
        title: "Equal Scene A",
        base: "0,0",
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-equal-b",
        timestamp: sharedTimestamp,
        title: "Equal Scene B",
        base: "0,0",
      })
      await deliverDeployment({
        worldName,
        entityId: "entity-equal-a",
        timestamp: sharedTimestamp,
        title: "Equal Scene A",
        base: "0,0",
      })

      const enabled = await PlaceModel.findEnabledWorldName(worldName)
      state = {
        activeCount: enabled.length,
        deploymentId: enabled[0]?.deployment_id ?? null,
        title: enabled[0]?.title ?? null,
      }
    })

    it("should keep one active place and reject replay of the scene replaced at the tie", () => {
      expect(state).toEqual({
        activeCount: 1,
        deploymentId: "entity-equal-b",
        title: "Equal Scene B",
      })
    })
  })

  describe("and an undeployment targets one unambiguous legacy place", () => {
    let disabledReason: DisabledReason | null | undefined

    beforeEach(async () => {
      const worldName = "legacy-unique.dcl.eth"
      const deployedAt = Date.parse("2026-08-10T23:00:00.000Z")
      await deliverDeployment({
        worldName,
        entityId: "entity-legacy-original",
        timestamp: deployedAt,
        title: "Unique Legacy Scene",
        base: "0,0",
      })
      const place = await PlaceModel.findByWorldIdAndBasePosition(
        worldName,
        "0,0"
      )
      if (!place) {
        throw new Error("Expected the legacy test place to exist")
      }
      await PlaceModel.updatePlace({ ...place, deployment_id: null }, [
        "deployment_id",
      ])
      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [{ entityId: "unknown-legacy-entity", baseParcel: "0,0" }],
          { timestamp: deployedAt + 1 }
        )
      )

      disabledReason = (
        await PlaceModel.findByWorldIdAndBasePosition(worldName, "0,0")
      )?.disabled_reason
    })

    it("should disable the legacy row through its unique base position", () => {
      expect(disabledReason).toBe(DisabledReason.UNDEPLOYMENT)
    })
  })

  describe("and an undeployment footprint overlaps multiple active legacy places", () => {
    let enabledCount: number

    beforeEach(async () => {
      const worldName = "legacy-ambiguous.dcl.eth"
      const deployedAt = Date.parse("2026-08-11T00:00:00.000Z")
      await deliverDeployment({
        worldName,
        entityId: "entity-legacy-first",
        timestamp: deployedAt,
        title: "Legacy Scene One",
        base: "0,0",
      })
      const firstPlace = await PlaceModel.findByWorldIdAndBasePosition(
        worldName,
        "0,0"
      )
      if (!firstPlace) {
        throw new Error("Expected the first legacy test place to exist")
      }
      const firstLegacyPlace: PlaceAttributes = {
        ...firstPlace,
        deployment_id: null,
      }
      await PlaceModel.updatePlace(firstLegacyPlace, ["deployment_id"])
      await PlaceModel.createOne({
        ...firstLegacyPlace,
        id: randomUUID(),
        title: "Legacy Scene Two",
      })

      await handleWorldScenesUndeployment(
        createWorldScenesUndeploymentEvent(
          worldName,
          [{ entityId: "unknown-ambiguous-entity", baseParcel: "0,0" }],
          { timestamp: deployedAt + 1 }
        )
      )
      enabledCount = (await PlaceModel.findEnabledWorldName(worldName)).length
    })

    it("should disable every stale row occupying the authoritative footprint", () => {
      expect(enabledCount).toBe(0)
    })
  })
})
