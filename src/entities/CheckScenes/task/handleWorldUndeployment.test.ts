import { Events } from "@dcl/schemas"
import { WorldUndeploymentEvent } from "@dcl/schemas/dist/platform/events/world"

import { fetchWorldActiveScenes } from "./fetchWorldActiveScenes"
import { handleWorldUndeployment } from "./handleWorldUndeployment"
import PlaceModel from "../../Place/model"
import { PlaceAttributes } from "../../Place/types"
import WorldModel from "../../World/model"
import WorldDeploymentPositionWatermarkModel from "../../WorldDeploymentPositionWatermark/model"
import WorldSceneUndeploymentModel from "../../WorldSceneUndeployment/model"
import WorldUndeploymentModel from "../../WorldUndeployment/model"

jest.mock("./fetchWorldActiveScenes")

const fetchWorldActiveScenesMock = jest.mocked(fetchWorldActiveScenes)

describe("when handling a world undeployment event", () => {
  let disableByWorldId: jest.SpyInstance
  let lockWorldForDeployment: jest.SpyInstance
  let findWorldPositions: jest.SpyInstance
  let recordPositions: jest.SpyInstance
  let recordScenes: jest.SpyInstance
  let recordWatermark: jest.SpyInstance
  let calls: string[]
  let event: WorldUndeploymentEvent

  beforeEach(() => {
    calls = []
    fetchWorldActiveScenesMock.mockResolvedValue({
      deploymentIds: [],
      positions: [],
      oldestDeployedAt: null,
    })
    lockWorldForDeployment = jest
      .spyOn(WorldModel, "lockWorldForDeployment")
      .mockImplementation(async () => {
        calls.push("lock")
      })
    recordWatermark = jest
      .spyOn(WorldUndeploymentModel, "recordWatermark")
      .mockImplementation(async () => {
        calls.push("watermark")
      })
    recordScenes = jest
      .spyOn(WorldSceneUndeploymentModel, "recordScenes")
      .mockImplementation(async () => {
        calls.push("scene-watermark")
      })
    findWorldPositions = jest
      .spyOn(PlaceModel, "findWorldPositions")
      .mockResolvedValue([])
    recordPositions = jest
      .spyOn(WorldDeploymentPositionWatermarkModel, "recordPositions")
      .mockImplementation(async () => {
        calls.push("position-watermark")
      })
    disableByWorldId = jest
      .spyOn(PlaceModel, "disableByWorldId")
      .mockImplementation(async () => {
        calls.push("disable")
        return []
      })
    event = {
      type: Events.Type.WORLD,
      subType: Events.SubType.Worlds.WORLD_UNDEPLOYMENT,
      key: "example.dcl.eth",
      timestamp: Date.parse("2026-08-03T12:00:00.000Z"),
      metadata: {
        worldName: "example.dcl.eth",
      },
    }
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  it("should disable the world places as of the event timestamp", async () => {
    await handleWorldUndeployment(event)

    expect(disableByWorldId).toHaveBeenCalledWith(
      "example.dcl.eth",
      event.timestamp,
      [],
      []
    )
  })

  it("should take the per-world deployment lock", async () => {
    await handleWorldUndeployment(event)

    expect(lockWorldForDeployment).toHaveBeenCalledWith("example.dcl.eth")
  })

  it("should record the undeployment watermark with the event timestamp", async () => {
    await handleWorldUndeployment(event)

    expect(recordWatermark).toHaveBeenCalledWith(
      "example.dcl.eth",
      event.timestamp
    )
  })

  it("should take the lock and persist the watermark before disabling any row", async () => {
    await handleWorldUndeployment(event)

    expect(calls).toEqual(["lock", "watermark", "disable"])
  })

  it("should not sweep parcels when the world was torn down, since the world watermark covers it", async () => {
    await handleWorldUndeployment(event)

    expect(recordPositions).not.toHaveBeenCalled()
  })

  describe("and the world still serves scenes after the undeployment", () => {
    let oldestSurvivorDeployedAt: number
    let survivingDeployedAt: Date
    let removedPlace: PlaceAttributes

    beforeEach(() => {
      survivingDeployedAt = new Date(Date.parse("2026-08-03T11:59:00.000Z"))
      removedPlace = {
        id: "place-removed",
        deployment_id: "deployment-removed",
        base_position: "1,1",
        // decentraland-gatsby's pg parser hands timestamp columns back as ISO strings, so the
        // fixture uses one even though PlaceAttributes types it as a Date
        deployed_at: survivingDeployedAt.toISOString(),
      } as unknown as PlaceAttributes
      oldestSurvivorDeployedAt = Date.parse("2026-08-02T10:00:00.000Z")
      fetchWorldActiveScenesMock.mockResolvedValue({
        deploymentIds: ["deployment-surviving"],
        positions: ["0,0"],
        oldestDeployedAt: oldestSurvivorDeployedAt,
      })
      disableByWorldId.mockImplementation(async () => {
        calls.push("disable")
        return [removedPlace]
      })
    })

    it("should exclude the surviving deployment from the disabled rows", async () => {
      await handleWorldUndeployment(event)

      expect(disableByWorldId).toHaveBeenCalledWith(
        "example.dcl.eth",
        event.timestamp,
        ["deployment-surviving"],
        ["0,0"]
      )
    })

    it("should record the full-world watermark just below the oldest survivor", async () => {
      await handleWorldUndeployment(event)

      expect(recordWatermark).toHaveBeenCalledWith(
        "example.dcl.eth",
        oldestSurvivorDeployedAt - 1
      )
    })

    it("should not record the event timestamp, which would reject the survivors", async () => {
      await handleWorldUndeployment(event)

      expect(recordWatermark).not.toHaveBeenCalledWith(
        "example.dcl.eth",
        event.timestamp
      )
    })

    describe("and no served scene reported a deployment timestamp", () => {
      beforeEach(() => {
        fetchWorldActiveScenesMock.mockResolvedValue({
          deploymentIds: ["deployment-surviving"],
          positions: ["0,0"],
          oldestDeployedAt: null,
        })
      })

      it("should record no full-world watermark rather than guess a bound", async () => {
        await handleWorldUndeployment(event)

        expect(recordWatermark).not.toHaveBeenCalled()
      })
    })

    it("should watermark the parcels the world held that nothing serves now", async () => {
      findWorldPositions.mockResolvedValue(["1,1", "0,0", "2,2"])

      await handleWorldUndeployment(event)

      expect(recordPositions).toHaveBeenCalledWith(
        "example.dcl.eth",
        ["1,1", "2,2"],
        new Date(event.timestamp),
        true
      )
    })

    it("should record a scene watermark for every removed place", async () => {
      await handleWorldUndeployment(event)

      expect(recordScenes).toHaveBeenCalledWith("example.dcl.eth", [
        {
          entityId: "deployment-removed",
          baseParcel: "1,1",
          undeployedAt: survivingDeployedAt,
        },
      ])
    })

    describe("and a removed place predates deployment ids", () => {
      beforeEach(() => {
        removedPlace.deployment_id = null
      })

      it("should key its watermark on the local place id", async () => {
        await handleWorldUndeployment(event)

        expect(recordScenes).toHaveBeenCalledWith("example.dcl.eth", [
          {
            entityId: "legacy-place:place-removed",
            baseParcel: "1,1",
            undeployedAt: survivingDeployedAt,
          },
        ])
      })
    })
  })

  describe("and the active scene set cannot be read", () => {
    beforeEach(() => {
      fetchWorldActiveScenesMock.mockRejectedValue(
        new Error("worlds content server is unreachable")
      )
    })

    it("should rethrow so the message is retried", async () => {
      await expect(handleWorldUndeployment(event)).rejects.toThrow(
        "worlds content server is unreachable"
      )
    })

    it("should not disable any place record", async () => {
      await expect(handleWorldUndeployment(event)).rejects.toThrow()

      expect(disableByWorldId).not.toHaveBeenCalled()
    })
  })
})
