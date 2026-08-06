import { Events } from "@dcl/schemas"
import { WorldUndeploymentEvent } from "@dcl/schemas/dist/platform/events/world"

import { handleWorldUndeployment } from "./handleWorldUndeployment"
import PlaceModel from "../../Place/model"
import WorldModel from "../../World/model"
import WorldUndeploymentModel from "../../WorldUndeployment/model"

describe("when handling a world undeployment event", () => {
  let disableByWorldId: jest.SpyInstance
  let lockWorldForDeployment: jest.SpyInstance
  let recordWatermark: jest.SpyInstance
  let calls: string[]
  let event: WorldUndeploymentEvent

  beforeEach(() => {
    calls = []
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
    disableByWorldId = jest
      .spyOn(PlaceModel, "disableByWorldId")
      .mockImplementation(async () => {
        calls.push("disable")
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
  })

  it("should disable the world places as of the event timestamp", async () => {
    await handleWorldUndeployment(event)

    expect(disableByWorldId).toHaveBeenCalledWith(
      "example.dcl.eth",
      event.timestamp
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
})
