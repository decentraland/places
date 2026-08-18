import { Events, WorldScenesUndeploymentEvent } from "@dcl/schemas"

import { InvalidWorldSqsMessageError } from "./errors"
import { fetchWorldActiveScenesAtPositions } from "./fetchWorldActiveScenes"
import { handleWorldScenesUndeployment } from "./handleWorldScenesUndeployment"
import {
  fetchContentEntity,
  getTrustedWorldsContentServerUrl,
} from "./processEntityId"
import { resolveWorldSceneUndeploymentFootprints } from "./resolveWorldSceneUndeploymentFootprints"
import PlaceModel from "../../Place/model"
import WorldModel from "../../World/model"
import WorldDeploymentPositionWatermarkModel from "../../WorldDeploymentPositionWatermark/model"
import WorldSceneUndeploymentModel from "../../WorldSceneUndeployment/model"

jest.mock("./resolveWorldSceneUndeploymentFootprints")
jest.mock("./fetchWorldActiveScenes")
jest.mock("./processEntityId")

const resolveFootprintsMock = jest.mocked(
  resolveWorldSceneUndeploymentFootprints
)
const fetchWorldActiveScenesMock = jest.mocked(
  fetchWorldActiveScenesAtPositions
)
const fetchContentEntityMock = jest.mocked(fetchContentEntity)
const getTrustedUrlMock = jest.mocked(getTrustedWorldsContentServerUrl)

describe("when handling a world scenes undeployment event", () => {
  let disableByWorldIdAndDeployments: jest.SpyInstance
  let findDeployedAtByDeploymentIds: jest.SpyInstance
  let lockWorldForDeployment: jest.SpyInstance
  let recordPositions: jest.SpyInstance
  let recordScenes: jest.SpyInstance
  let calls: string[]
  let event: WorldScenesUndeploymentEvent
  let removedEntityDeployedAt: number

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
    getTrustedUrlMock.mockReturnValue("https://worlds.example")
    removedEntityDeployedAt = Date.parse("2026-07-28T08:00:00.000Z")
    fetchContentEntityMock.mockResolvedValue({
      timestamp: removedEntityDeployedAt,
    } as never)
    lockWorldForDeployment = jest
      .spyOn(WorldModel, "lockWorldForDeployment")
      .mockImplementation(async () => {
        calls.push("lock")
      })
    findDeployedAtByDeploymentIds = jest
      .spyOn(PlaceModel, "findDeployedAtByDeploymentIds")
      .mockResolvedValue(new Map())
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
      []
    )
  })

  it("should take the per-world deployment lock", async () => {
    await handleWorldScenesUndeployment(event)

    expect(lockWorldForDeployment).toHaveBeenCalledWith("example.dcl.eth")
  })

  it("should record every undeployed scene with the removed content's own timestamp", async () => {
    await handleWorldScenesUndeployment(event)

    expect(recordScenes).toHaveBeenCalledWith("example.dcl.eth", [
      {
        entityId: "deployment-a",
        baseParcel: "1,1",
        parcels: ["1,1"],
        undeployedAt: new Date(removedEntityDeployedAt),
      },
      {
        entityId: "deployment-b",
        baseParcel: "2,2",
        parcels: ["2,2"],
        undeployedAt: new Date(removedEntityDeployedAt),
      },
    ])
  })

  it("should read the removed content's timestamp from its immutable entity when no place row has it", async () => {
    await handleWorldScenesUndeployment(event)

    expect(fetchContentEntityMock).toHaveBeenCalledWith(
      "deployment-a",
      "https://worlds.example"
    )
  })

  it("should never stamp a watermark later than the removal itself", async () => {
    fetchContentEntityMock.mockResolvedValue({
      timestamp: event.timestamp + 60_000,
    } as never)

    await handleWorldScenesUndeployment(event)

    expect(recordScenes).toHaveBeenCalledWith("example.dcl.eth", [
      expect.objectContaining({ undeployedAt: new Date(event.timestamp) }),
      expect.objectContaining({ undeployedAt: new Date(event.timestamp) }),
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

  describe("and a place row records when the undeployed content was deployed", () => {
    let removedDeployedAt: Date

    beforeEach(() => {
      removedDeployedAt = new Date(Date.parse("2026-07-30T10:00:00.000Z"))
      findDeployedAtByDeploymentIds.mockResolvedValue(
        new Map([["deployment-a", removedDeployedAt]])
      )
    })

    it("should watermark that scene with the timestamp the place row records", async () => {
      await handleWorldScenesUndeployment(event)

      expect(recordScenes).toHaveBeenCalledWith("example.dcl.eth", [
        {
          entityId: "deployment-a",
          baseParcel: "1,1",
          parcels: ["1,1"],
          undeployedAt: removedDeployedAt,
        },
        {
          entityId: "deployment-b",
          baseParcel: "2,2",
          parcels: ["2,2"],
          undeployedAt: new Date(removedEntityDeployedAt),
        },
      ])
    })

    it("should not fetch the entity for a scene a place row already accounts for", async () => {
      await handleWorldScenesUndeployment(event)

      expect(fetchContentEntityMock).not.toHaveBeenCalledWith(
        "deployment-a",
        expect.anything()
      )
    })
  })

  describe("and the immutable entity supplied its deployment timestamp", () => {
    let removedDeployedAt: number

    beforeEach(() => {
      removedDeployedAt = Date.parse("2026-07-29T09:00:00.000Z")
      resolveFootprintsMock.mockImplementation(async (scenes) =>
        scenes.map((scene) => ({
          entityId: scene.entityId,
          baseParcel: scene.baseParcel,
          parcels: [scene.baseParcel],
          deployedAt: removedDeployedAt,
        }))
      )
    })

    it("should watermark the scenes with that timestamp instead of the event's", async () => {
      await handleWorldScenesUndeployment(event)

      expect(recordScenes).toHaveBeenCalledWith("example.dcl.eth", [
        {
          entityId: "deployment-a",
          baseParcel: "1,1",
          parcels: ["1,1"],
          undeployedAt: new Date(removedDeployedAt),
        },
        {
          entityId: "deployment-b",
          baseParcel: "2,2",
          parcels: ["2,2"],
          undeployedAt: new Date(removedDeployedAt),
        },
      ])
    })

    it("should not look up a timestamp the resolver already supplied", async () => {
      await handleWorldScenesUndeployment(event)

      expect(findDeployedAtByDeploymentIds).toHaveBeenCalledWith(
        "example.dcl.eth",
        []
      )
    })
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
        ["2,2"]
      )
    })

    it("should leave the served scene out of the watermark", async () => {
      await handleWorldScenesUndeployment(event)

      expect(recordScenes).toHaveBeenCalledWith("example.dcl.eth", [
        {
          entityId: "deployment-a",
          baseParcel: "1,1",
          parcels: ["1,1"],
          undeployedAt: new Date(removedEntityDeployedAt),
        },
      ])
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
          undeployedAt: new Date(removedEntityDeployedAt),
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
