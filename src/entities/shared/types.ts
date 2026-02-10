import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

/**
 * Base attributes shared between places and worlds.
 * These fields exist on both entities with identical types.
 */
export interface BaseEntityAttributes {
  /**
   * Unique identifier for the entity.
   * - For places: auto-generated UUID
   * - For worlds: lowercased world_name (e.g., "foo.dcl.eth")
   */
  id: string
  title: string | null
  description: string | null
  image: string | null
  owner: string | null
  /** World name - always present for worlds, may be null for genesis places */
  world_name: string | null
  content_rating: SceneContentRating
  categories: string[]
  likes: number
  dislikes: number
  favorites: number
  like_rate: number | null
  like_score: number | null
  disabled: boolean
  disabled_at: Date | null
  created_at: Date
  updated_at: Date
}

/**
 * Base aggregate attributes for user interactions.
 * These fields are added when fetching entities with user-specific data.
 */
export interface BaseAggregateAttributes {
  user_like: boolean
  user_dislike: boolean
  user_favorite: boolean
  user_count?: number
  /** Number of users that visited in the last 30 days (0 for worlds until stats are available) */
  user_visits: number
  /** Whether this is a world entity */
  world: boolean
  /** Contact name - from place directly or from latest place for worlds */
  contact_name: string | null
  /** Base position - actual for places, "0,0" for worlds */
  base_position: string
  /** Deployment date - from place directly or from latest place for worlds */
  deployed_at: Date | null
}

/**
 * Combined base entity and aggregate attributes.
 * Use this type for components that work with both places and worlds.
 */
export interface AggregateBaseEntityAttributes
  extends BaseEntityAttributes,
    BaseAggregateAttributes {}
