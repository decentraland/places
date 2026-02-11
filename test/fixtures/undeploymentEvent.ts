import { Events } from "@dcl/schemas/dist/platform/events/base"
import {
  WorldScenesUndeploymentEvent,
  WorldUndeploymentEvent,
} from "@dcl/schemas/dist/platform/events/world"

/**
 * Creates a WorldUndeploymentEvent for a full world undeployment.
 */
export function createWorldUndeploymentEvent(
  worldName: string,
  options: { timestamp?: number } = {}
): WorldUndeploymentEvent {
  return {
    type: Events.Type.WORLD,
    subType: Events.SubType.Worlds.WORLD_UNDEPLOYMENT,
    key: worldName,
    timestamp: options.timestamp ?? Date.now(),
    metadata: {
      worldName,
    },
  }
}

/**
 * Creates a WorldScenesUndeploymentEvent for undeploying specific scenes.
 */
export function createWorldScenesUndeploymentEvent(
  worldName: string,
  scenes: Array<{ entityId: string; baseParcel: string }>,
  options: { timestamp?: number } = {}
): WorldScenesUndeploymentEvent {
  return {
    type: Events.Type.WORLD,
    subType: Events.SubType.Worlds.WORLD_SCENES_UNDEPLOYMENT,
    key: worldName,
    timestamp: options.timestamp ?? Date.now(),
    metadata: {
      worldName,
      scenes,
    },
  }
}
