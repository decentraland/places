import { BaseAggregateAttributes, BaseEntityAttributes } from "../shared/types"

/**
 * World-specific attributes that extend the base entity.
 *
 * Note on ID and world_name:
 * - `id` is the lowercased world name (e.g., "foo.dcl.eth"), making IDs predictable
 * - `world_name` (from BaseEntityAttributes) stores the original casing for display purposes
 * - In practice, world names are typically lowercase, but we preserve the original value
 */
export type WorldAttributes = BaseEntityAttributes & {
  show_in_places: boolean
  single_player: boolean
  skybox_time: number | null
  is_private: boolean
}

/**
 * World attributes with user-specific aggregate data.
 * Inherits common aggregate properties (user_visits, world, contact_name, base_position, deployed_at)
 * from BaseAggregateAttributes.
 */
export type AggregateWorldAttributes = WorldAttributes & BaseAggregateAttributes

export type GetWorldParams = {
  world_id: string
}

export type GetWorldListQuery = {
  limit: string
  offset: string
  names: string[]
  only_favorites: string
  order_by: string
  order: string
  search: string
  categories: string[]
  disabled: string
  owner?: string
}

export enum WorldListOrderBy {
  LIKE_SCORE_BEST = "like_score",
  MOST_ACTIVE = "most_active",
  CREATED_AT = "created_at",
}

export type WorldListOptions = {
  offset: number
  limit: number
  only_favorites: boolean
  names: string[]
  order_by: string
  order: string
  search: string
  categories: string[]
  owner?: string
}

export type FindWorldWithAggregatesOptions = WorldListOptions & {
  user?: string
  disabled?: boolean
}

export type WorldLivePerWorldProps = {
  users: number
  worldName: string
}

export type WorldLiveDataProps = {
  perWorld: WorldLivePerWorldProps[]
  totalUsers: number
}
