import { Events } from "@dcl/schemas/dist/platform/events/base"
import { WorldSettingsChangedEvent } from "@dcl/schemas/dist/platform/events/world"

/**
 * A WorldSettingsChangedEvent for creating a new world with all settings.
 */
export function createWorldSettingsChangedEvent(
  overrides: Partial<WorldSettingsChangedEvent> & {
    metadata?: Partial<WorldSettingsChangedEvent["metadata"]>
  } = {}
): WorldSettingsChangedEvent {
  return {
    type: Events.Type.WORLD,
    subType: Events.SubType.Worlds.WORLD_SETTINGS_CHANGED,
    key: "testworld.dcl.eth",
    timestamp: Date.now(),
    ...overrides,
    metadata: {
      worldName: "testworld.dcl.eth",
      ...overrides.metadata,
    } as WorldSettingsChangedEvent["metadata"],
  }
}

/**
 * A WorldSettingsChangedEvent that upgrades the content rating.
 */
export function createWorldSettingsUpgradeRatingEvent(
  worldName: string
): WorldSettingsChangedEvent {
  return createWorldSettingsChangedEvent({
    key: worldName,
    metadata: {
      worldName: worldName,
      contentRating: "A",
    },
  })
}

/**
 * A WorldSettingsChangedEvent that downgrades the content rating.
 * The system should block this and preserve the original rating.
 */
export function createWorldSettingsDowngradeRatingEvent(
  worldName: string
): WorldSettingsChangedEvent {
  return createWorldSettingsChangedEvent({
    key: worldName,
    metadata: {
      worldName: worldName,
      contentRating: "RP",
    },
  })
}

/**
 * A WorldSettingsChangedEvent missing the key (world name).
 */
export function createWorldSettingsEventMissingKey(): WorldSettingsChangedEvent {
  return createWorldSettingsChangedEvent({
    key: "",
  })
}
