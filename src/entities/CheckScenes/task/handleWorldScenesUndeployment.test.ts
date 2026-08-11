import { Events } from "@dcl/schemas"

import { InvalidWorldSqsMessageError } from "./errors"
import { handleWorldScenesUndeployment } from "./handleWorldScenesUndeployment"
import { resolveWorldSceneUndeploymentFootprints } from "./resolveWorldSceneUndeploymentFootprints"
import { WorldScenesUndeploymentEventWithParcels } from "./worldScenesUndeploymentEvent"
import PlaceModel from "../../Place/model"
import WorldModel from "../../World/model"
import WorldDeploymentPositionWatermarkModel from "../../WorldDeploymentPositionWatermark/model"
import WorldSceneUndeploymentModel from "../../WorldSceneUndeployment/model"

jest.mock("./resolveWorldSceneUndeploymentFootprints")

const resolveFootprintsMock = jest.mocked(
  resolveWorldSceneUndeploymentFootprints
)

describe("when handling a world scenes undeployment event", () => {
  let disableByWorldIdAndDeployments: jest.SpyInstance
  let lockWorldForDeployment: jest.SpyInstance
  let recordPositions: jest.SpyInstance
  let recordScenes: jest.SpyInstance
  let calls: string[]
  let event: WorldScenesUndeploymentEventWithParcels

  beforeEach(() => {
    calls = []
    resolveFootprintsMock.mockImplementation(async (scenes) =>
      scenes.map((scene) => ({
        ...scene,
        parcels: scene.parcels ?? [scene.baseParcel],
      }))
    )
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
  })

  it("should disable the exact deployment identities", async () => {
    await handleWorldScenesUndeployment(event)

    expect(disableByWorldIdAndDeployments).toHaveBeenCalledWith(
      "example.dcl.eth",
      ["deployment-a", "deployment-b"],
      ["1,1", "2,2"],
      ["1,1", "2,2"],
      event.timestamp
    )
  })

  it("should take the per-world deployment lock", async () => {
    await handleWorldScenesUndeployment(event)

    expect(lockWorldForDeployment).toHaveBeenCalledWith("example.dcl.eth")
  })

  it("should record every undeployed scene with the event timestamp", async () => {
    await handleWorldScenesUndeployment(event)

    expect(recordScenes).toHaveBeenCalledWith(
      "example.dcl.eth",
      [
        { ...event.metadata.scenes[0], parcels: ["1,1"] },
        { ...event.metadata.scenes[1], parcels: ["2,2"] },
      ],
      event.timestamp
    )
  })

  it("should record every retired position with the event timestamp", async () => {
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

  describe("and the event repeats the same scene", () => {
    beforeEach(() => {
      event.metadata.scenes = [
        { entityId: "deployment-a", baseParcel: "1,1" },
        { entityId: "deployment-a", baseParcel: "1,1" },
      ]
    })

    it("should record one watermark for the repeated scene", async () => {
      await handleWorldScenesUndeployment(event)

      expect(recordScenes).toHaveBeenCalledWith(
        "example.dcl.eth",
        [
          {
            entityId: "deployment-a",
            baseParcel: "1,1",
            parcels: ["1,1"],
          },
        ],
        event.timestamp
      )
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
