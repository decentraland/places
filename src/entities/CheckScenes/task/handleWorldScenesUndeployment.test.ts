import { Events } from "@dcl/schemas"
import { WorldScenesUndeploymentEvent } from "@dcl/schemas/dist/platform/events/world"

import { handleWorldScenesUndeployment } from "./handleWorldScenesUndeployment"
import PlaceModel from "../../Place/model"

describe("when handling a world scenes undeployment event", () => {
  let disableByWorldIdAndDeployments: jest.SpyInstance
  let event: WorldScenesUndeploymentEvent

  beforeEach(() => {
    disableByWorldIdAndDeployments = jest
      .spyOn(PlaceModel, "disableByWorldIdAndDeployments")
      .mockResolvedValue(undefined)
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
})
