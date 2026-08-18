import { Events, WorldScenesUndeploymentEvent } from "@dcl/schemas"

import { InvalidWorldSqsMessageError } from "./errors"
import { fetchWorldActiveScenesAtPositions } from "./fetchWorldActiveScenes"
import { handleWorldScenesUndeployment } from "./handleWorldScenesUndeployment"
import { resolveWorldSceneUndeploymentFootprints } from "./resolveWorldSceneUndeploymentFootprints"
import PlaceModel from "../../Place/model"
import WorldModel from "../../World/model"
import WorldDeploymentPositionWatermarkModel from "../../WorldDeploymentPositionWatermark/model"
import WorldSceneUndeploymentModel from "../../WorldSceneUndeployment/model"

jest.mock("./resolveWorldSceneUndeploymentFootprints")
jest.mock("./fetchWorldActiveScenes")

const resolveFootprintsMock = jest.mocked(
  resolveWorldSceneUndeploymentFootprints
)
const fetchWorldActiveScenesMock = jest.mocked(
  fetchWorldActiveScenesAtPositions
)

describe("when handling a world scenes undeployment event", () => {
  let disableByWorldIdAndDeployments: jest.SpyInstance
  let findEnabledWorldPlaceRevisions: jest.SpyInstance
  let snapshot: Array<{ id: string; deployment_id: string | null }>
  let lockWorldForDeployment: jest.SpyInstance
  let recordPositions: jest.SpyInstance
  let recordScenes: jest.SpyInstance
  let calls: string[]
  let event: WorldScenesUndeploymentEvent

  beforeEach(() => {
    calls = []
    resolveFootprintsMock.mockImplementation(async (scenes) =>
      scenes.map((scene) => ({
        entityId: scene.entityId,
        baseParcel: scene.baseParcel,
        parcels: scene.parcels ?? [scene.baseParcel],
        deployedAt: null,
      }))
    )
    fetchWorldActiveScenesMock.mockResolvedValue({
      deploymentIds: [],
      positions: [],
    })
    snapshot = [{ id: "place-a", deployment_id: "deployment-a" }]
    findEnabledWorldPlaceRevisions = jest
      .spyOn(PlaceModel, "findEnabledWorldPlaceRevisions")
      .mockResolvedValue(snapshot)
    lockWorldForDeployment = jest
      .spyOn(WorldModel, "lockWorldForDeployment")
      .mockImplementation(async () => {
        calls.push("lock")
      })
    recordScenes = jest
      .spyOn(WorldSceneUndeploymentModel, "recordScenes")
      .mockImplementation(async () => {
        calls.push("watermark")
      })
    recordPositions = jest
      .spyOn(WorldDeploymentPositionWatermarkModel, "recordPositions")
      .mockImplementation(async () => {
        calls.push("position-watermark")
      })
    disableByWorldIdAndDeployments = jest
      .spyOn(PlaceModel, "disableByWorldIdAndDeployments")
      .mockImplementation(async () => {
        calls.push("disable")
        return { deploymentIdMatches: 2, legacyBaseMatches: 0 }
      })
    event = {
      type: Events.Type.WORLD,
      subType: Events.SubType.Worlds.WORLD_SCENES_UNDEPLOYMENT,
      key: "example.dcl.eth",
      timestamp: Date.parse("2026-08-03T12:00:00.000Z"),
      metadata: {
        worldName: "example.dcl.eth",
        scenes: [
          { entityId: "deployment-a", baseParcel: "1,1" },
          { entityId: "deployment-b", baseParcel: "2,2" },
        ],
      },
    }
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  it("should disable the exact deployment identities", async () => {
    await handleWorldScenesUndeployment(event)

    expect(disableByWorldIdAndDeployments).toHaveBeenCalledWith(
      "example.dcl.eth",
      ["deployment-a", "deployment-b"],
      ["1,1", "2,2"],
      ["1,1", "2,2"],
      event.timestamp,
      [],
      [],
      snapshot
    )
  })

  it("should take the per-world deployment lock", async () => {
    await handleWorldScenesUndeployment(event)

    expect(lockWorldForDeployment).toHaveBeenCalledWith("example.dcl.eth")
  })

  it("should record every undeployed scene with the event timestamp", async () => {
    await handleWorldScenesUndeployment(event)

    expect(recordScenes).toHaveBeenCalledWith("example.dcl.eth", [
      {
        entityId: "deployment-a",
        baseParcel: "1,1",
        parcels: ["1,1"],
        undeployedAt: new Date(event.timestamp),
      },
      {
        entityId: "deployment-b",
        baseParcel: "2,2",
        parcels: ["2,2"],
        undeployedAt: new Date(event.timestamp),
      },
    ])
  })

  it("should record every cleared position with the event timestamp", async () => {
    await handleWorldScenesUndeployment(event)

    expect(recordPositions).toHaveBeenCalledWith(
      "example.dcl.eth",
      ["1,1", "2,2"],
      new Date(event.timestamp),
      true
    )
  })

  it("should take the lock and persist the watermark before disabling any row", async () => {
    await handleWorldScenesUndeployment(event)

    expect(calls).toEqual([
      "lock",
      "watermark",
      "position-watermark",
      "disable",
    ])
  })

  describe("and the world still serves one of the undeployed scenes", () => {
    beforeEach(() => {
      fetchWorldActiveScenesMock.mockResolvedValue({
        deploymentIds: ["deployment-b"],
        positions: ["2,2"],
      })
    })

    it("should leave the served scene out of the disabled identities", async () => {
      await handleWorldScenesUndeployment(event)

      expect(disableByWorldIdAndDeployments).toHaveBeenCalledWith(
        "example.dcl.eth",
        ["deployment-a"],
        ["1,1"],
        ["1,1"],
        event.timestamp,
        ["deployment-b"],
        ["2,2"],
        snapshot
      )
    })

    it("should leave the served scene out of the watermark", async () => {
      await handleWorldScenesUndeployment(event)

      expect(recordScenes).toHaveBeenCalledWith("example.dcl.eth", [
        {
          entityId: "deployment-a",
          baseParcel: "1,1",
          parcels: ["1,1"],
          undeployedAt: new Date(event.timestamp),
        },
      ])
    })
  })

  describe("and the immutable entity supplied the removed content's timestamp", () => {
    let removedDeployedAt: number

    beforeEach(() => {
      removedDeployedAt = Date.parse("2026-07-30T10:00:00.000Z")
      resolveFootprintsMock.mockImplementation(async (scenes) =>
        scenes.map((scene) => ({
          entityId: scene.entityId,
          baseParcel: scene.baseParcel,
          parcels: scene.parcels ?? [scene.baseParcel],
          deployedAt: removedDeployedAt,
        }))
      )
    })

    it("should bound the watermark by it instead of the emission time", async () => {
      await handleWorldScenesUndeployment(event)

      expect(recordScenes).toHaveBeenCalledWith("example.dcl.eth", [
        expect.objectContaining({
          undeployedAt: new Date(removedDeployedAt),
        }),
        expect.objectContaining({
          undeployedAt: new Date(removedDeployedAt),
        }),
      ])
    })

    describe("and that timestamp is somehow later than the removal", () => {
      beforeEach(() => {
        resolveFootprintsMock.mockImplementation(async (scenes) =>
          scenes.map((scene) => ({
            entityId: scene.entityId,
            baseParcel: scene.baseParcel,
            parcels: scene.parcels ?? [scene.baseParcel],
            deployedAt: event.timestamp + 60_000,
          }))
        )
      })

      it("should clamp it to the removal, since content cannot be removed first", async () => {
        await handleWorldScenesUndeployment(event)

        expect(recordScenes).toHaveBeenCalledWith("example.dcl.eth", [
          expect.objectContaining({ undeployedAt: new Date(event.timestamp) }),
          expect.objectContaining({ undeployedAt: new Date(event.timestamp) }),
        ])
      })
    })
  })

  describe("and the world still serves the base parcel of an undeployed scene", () => {
    beforeEach(() => {
      fetchWorldActiveScenesMock.mockResolvedValue({
        deploymentIds: ["deployment-replacement"],
        positions: ["1,1"],
      })
    })

    it("should not claim that base, which would reject the deployment serving it", async () => {
      await handleWorldScenesUndeployment(event)

      expect(recordScenes).toHaveBeenCalledWith("example.dcl.eth", [
        {
          entityId: "deployment-b",
          baseParcel: "2,2",
          parcels: ["2,2"],
          undeployedAt: new Date(event.timestamp),
        },
      ])
    })

    it("should still disable the place for that scene", async () => {
      await handleWorldScenesUndeployment(event)

      expect(disableByWorldIdAndDeployments).toHaveBeenCalledWith(
        "example.dcl.eth",
        ["deployment-a", "deployment-b"],
        ["1,1", "2,2"],
        ["1,1", "2,2"],
        event.timestamp,
        ["deployment-replacement"],
        ["1,1"],
        snapshot
      )
    })
  })

  describe("and the world still serves a parcel the undeployment cleared", () => {
    beforeEach(() => {
      fetchWorldActiveScenesMock.mockResolvedValue({
        deploymentIds: ["deployment-c"],
        positions: ["2,2"],
      })
    })

    it("should not watermark the position the surviving scene occupies", async () => {
      await handleWorldScenesUndeployment(event)

      expect(recordPositions).toHaveBeenCalledWith(
        "example.dcl.eth",
        ["1,1"],
        new Date(event.timestamp),
        true
      )
    })
  })

  describe("and the world still serves every undeployed scene", () => {
    beforeEach(() => {
      fetchWorldActiveScenesMock.mockResolvedValue({
        deploymentIds: ["deployment-a", "deployment-b"],
        positions: ["1,1", "2,2"],
      })
    })

    it("should not disable any place record", async () => {
      await handleWorldScenesUndeployment(event)

      expect(disableByWorldIdAndDeployments).not.toHaveBeenCalled()
    })

    it("should not record any watermark", async () => {
      await handleWorldScenesUndeployment(event)

      expect(recordScenes).not.toHaveBeenCalled()
    })
  })

  describe("and the active scene set cannot be read", () => {
    beforeEach(() => {
      fetchWorldActiveScenesMock.mockRejectedValue(
        new Error("worlds content server is unreachable")
      )
    })

    it("should rethrow so the message is retried", async () => {
      await expect(handleWorldScenesUndeployment(event)).rejects.toThrow(
        "worlds content server is unreachable"
      )
    })

    it("should not disable any place record", async () => {
      await expect(handleWorldScenesUndeployment(event)).rejects.toThrow()

      expect(disableByWorldIdAndDeployments).not.toHaveBeenCalled()
    })
  })

  describe("and the event repeats the same scene", () => {
    beforeEach(() => {
      event.metadata.scenes = [
        { entityId: "deployment-a", baseParcel: "1,1" },
        { entityId: "deployment-a", baseParcel: "1,1" },
      ]
    })

    it("should record one watermark for the repeated scene", async () => {
      await handleWorldScenesUndeployment(event)

      expect(recordScenes).toHaveBeenCalledWith("example.dcl.eth", [
        {
          entityId: "deployment-a",
          baseParcel: "1,1",
          parcels: ["1,1"],
          undeployedAt: new Date(event.timestamp),
        },
      ])
    })
  })

  describe("and one deployment is repeated with conflicting bases", () => {
    beforeEach(() => {
      event.metadata.scenes = [
        { entityId: "deployment-a", baseParcel: "1,1" },
        { entityId: "deployment-a", baseParcel: "2,2" },
      ]
    })

    it("should reject the event as deterministically invalid", async () => {
      await expect(handleWorldScenesUndeployment(event)).rejects.toBeInstanceOf(
        InvalidWorldSqsMessageError
      )
    })
  })
})
