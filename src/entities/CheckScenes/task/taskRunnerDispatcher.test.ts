import { Events } from "@dcl/schemas"
import {
  WorldScenesUndeploymentEvent,
  WorldSettingsChangedEvent,
  WorldUndeploymentEvent,
} from "@dcl/schemas/dist/platform/events/world"

import { handleWorldScenesUndeployment } from "./handleWorldScenesUndeployment"
import { handleWorldSettingsChanged } from "./handleWorldSettingsChanged"
import { handleWorldUndeployment } from "./handleWorldUndeployment"
import { taskRunnerDispatcher } from "./taskRunnerDispatcher"
import { taskRunnerSqs } from "./taskRunnerSqs"
import { sqsMessage } from "../../../__data__/sqs"

jest.mock("./handleWorldScenesUndeployment")
jest.mock("./handleWorldSettingsChanged")
jest.mock("./handleWorldUndeployment")
jest.mock("./taskRunnerSqs")

const SOURCE = "https://worlds.example.org"

describe("when dispatching a world event that names its source server", () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe("and it is a settings change", () => {
    let event: WorldSettingsChangedEvent

    beforeEach(async () => {
      event = {
        type: Events.Type.WORLD,
        subType: Events.SubType.Worlds.WORLD_SETTINGS_CHANGED,
        key: "example.dcl.eth",
        timestamp: Date.parse("2026-11-23T00:00:00.000Z"),
        metadata: { worldName: "example.dcl.eth" },
      }
      await taskRunnerDispatcher(event, { sourceContentServerUrl: SOURCE })
    })

    it("should hand the source to the settings handler", () => {
      expect(handleWorldSettingsChanged).toHaveBeenCalledWith(
        event,
        undefined,
        undefined,
        SOURCE
      )
    })
  })

  describe("and it is a world undeployment", () => {
    let event: WorldUndeploymentEvent

    beforeEach(async () => {
      event = {
        type: Events.Type.WORLD,
        subType: Events.SubType.Worlds.WORLD_UNDEPLOYMENT,
        key: "example.dcl.eth",
        timestamp: Date.parse("2026-11-23T00:00:00.000Z"),
        metadata: { worldName: "example.dcl.eth" },
      }
      await taskRunnerDispatcher(event, { sourceContentServerUrl: SOURCE })
    })

    it("should hand the source to the world undeployment handler", () => {
      expect(handleWorldUndeployment).toHaveBeenCalledWith(event, SOURCE)
    })
  })

  describe("and it is a scenes undeployment", () => {
    let event: WorldScenesUndeploymentEvent

    beforeEach(async () => {
      event = {
        type: Events.Type.WORLD,
        subType: Events.SubType.Worlds.WORLD_SCENES_UNDEPLOYMENT,
        key: "example.dcl.eth",
        timestamp: Date.parse("2026-11-23T00:00:00.000Z"),
        metadata: {
          worldName: "example.dcl.eth",
          scenes: [{ entityId: "bafkreiexample", baseParcel: "0,0" }],
        },
      }
      await taskRunnerDispatcher(event, { sourceContentServerUrl: SOURCE })
    })

    it("should hand the source to the scenes undeployment handler", () => {
      expect(handleWorldScenesUndeployment).toHaveBeenCalledWith(event, SOURCE)
    })
  })

  describe("and it is a deployment", () => {
    beforeEach(async () => {
      await taskRunnerDispatcher(sqsMessage, {
        sourceContentServerUrl: SOURCE,
      })
    })

    it("should hand the source to the deployment handler", () => {
      expect(taskRunnerSqs).toHaveBeenCalledWith(sqsMessage, SOURCE)
    })
  })
})
