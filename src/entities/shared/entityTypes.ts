/**
 * Shared entity types for handling both places and worlds.
 *
 * Prefer using `AggregateBaseEntityAttributes` for components that only need
 * the common properties shared between places and worlds.
 *
 * Use union types (`AggregateEntityAttributes`) when you need to access
 * entity-specific properties and use type guards.
 */

import { AggregateBaseEntityAttributes } from "./types"
import { AggregatePlaceAttributes, PlaceAttributes } from "../Place/types"
import { AggregateWorldAttributes, WorldAttributes } from "../World/types"

// Re-export individual types for convenience
export type { PlaceAttributes, AggregatePlaceAttributes } from "../Place/types"
export type { WorldAttributes, AggregateWorldAttributes } from "../World/types"
export type {
  BaseEntityAttributes,
  BaseAggregateAttributes,
  AggregateBaseEntityAttributes,
} from "./types"

/**
 * Union type for any entity - aggregate or non-aggregate.
 * Use when a function can accept any form of place or world.
 */
export type AnyEntityAttributes =
  | PlaceAttributes
  | WorldAttributes
  | AggregatePlaceAttributes
  | AggregateWorldAttributes

/**
 * Type guard to check if an entity is a world.
 * Works for aggregate, non-aggregate, and base entity types.
 */
export function isWorld(
  entity: AnyEntityAttributes | AggregateBaseEntityAttributes
): entity is WorldAttributes | AggregateWorldAttributes {
  return "world" in entity && entity.world === true && !("positions" in entity)
}

/**
 * Type guard to check if an entity is a place.
 * Works for aggregate, non-aggregate, and base entity types.
 */
export function isPlace(
  entity: AnyEntityAttributes | AggregateBaseEntityAttributes
): entity is PlaceAttributes | AggregatePlaceAttributes {
  return "positions" in entity && Array.isArray(entity.positions)
}
