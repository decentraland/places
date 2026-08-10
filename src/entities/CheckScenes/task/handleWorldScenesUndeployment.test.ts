import { Events } from "@dcl/schemas"
import { WorldScenesUndeploymentEvent } from "@dcl/schemas/dist/platform/events/world"

import { handleWorldScenesUndeployment } from "./handleWorldScenesUndeployment"
import PlaceModel from "../../Place/model"
import WorldModel from "../../World/model"

describe("when handling a world scenes undeployment event", () => {
  let disableByWorldIdAndDeployments: jest.SpyInstance
  let lockWorldForDeployment: jest.SpyInstance
  let calls: string[]
  let event: WorldScenesUndeploymentEvent

  beforeEach(() => {
    calls = []
    lockWorldForDeployment = jest
      .spyOn(WorldModel, "lockWorldForDeployment")
      .mockImplementation(async () => {
        calls.push("lock")
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
      event.timestamp
    )
  })

  it("should take the per-world deployment lock", async () => {
    await handleWorldScenesUndeployment(event)

    expect(lockWorldForDeployment).toHaveBeenCalledWith("example.dcl.eth")
  })

  it("should take the lock before disabling any row", async () => {
    await handleWorldScenesUndeployment(event)

    expect(calls).toEqual(["lock", "disable"])
  })
})
