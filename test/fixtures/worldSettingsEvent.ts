import { Events } from "@dcl/schemas/dist/platform/events/base"
import { WorldSettingsChangedEvent } from "@dcl/schemas/dist/platform/events/world"

/** Extended metadata type that includes the accessType field not yet in @dcl/schemas */
type WorldSettingsMetadataWithAccess =
  WorldSettingsChangedEvent["metadata"] & {
    accessType?: string
  }

/**
 * A WorldSettingsChangedEvent for creating a new world with all settings.
 * Supports the optional `accessType` metadata field for privacy testing.
 */
export function createWorldSettingsChangedEvent(
  overrides: Partial<WorldSettingsChangedEvent> & {
    metadata?: Partial<WorldSettingsMetadataWithAccess>
  } = {}
): WorldSettingsChangedEvent {
  return {
    type: Events.Type.WORLD,
    subType: Events.SubType.Worlds.WORLD_SETTINGS_CHANGED,
    key: "testworld.dcl.eth",
    timestamp: Date.now(),
    ...overrides,
    metadata: {
      title: "Test World",
      description: "A test world for integration tests",
      contentRating: "T",
      categories: ["art", "game"],
      showInPlaces: true,
      singlePlayer: false,
      skyboxTime: null,
      thumbnailUrl: "https://example.com/thumbnail.png",
      ...overrides.metadata,
    },
  } as WorldSettingsChangedEvent
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

