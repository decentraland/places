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
  highlighted: boolean
  highlighted_image: string | null
  ranking: number | null
  /**
   * Keeps the automated discovery score from ranking this destination while it stays browsable.
   * Distinct from `highlighted`, `hidden` and `disabled`: featuring moves where it shows, hiding
   * takes it out of browse, disabling takes it out of the catalogue. This one only refuses the
   * automated ranking write, so a one-off like an internal event world can be listed normally
   * without the score deciding its position.
   */
  exclude_from_ranking: boolean
  /** worlds-content-server settings version last applied; orders mirrored writes. */
  settings_version: number | null
}

export type UpdateWorldHighlightBody = {
  highlighted: boolean
}

export type UpdateWorldRankingBody = {
  ranking: number | null
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
  only_excluded_from_ranking?: string
  order_by: string
  order: string
  search: string
  categories: string[]
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
  only_excluded_from_ranking?: boolean
  names: string[]
  order_by: string
  order: string
  search: string
  categories: string[]
  owner?: string
}

export type FindWorldWithAggregatesOptions = WorldListOptions & {
  user?: string
}

export type WorldLivePerWorldProps = {
  users: number
  worldName: string
}

export type WorldLiveDataProps = {
  perWorld: WorldLivePerWorldProps[]
  totalUsers: number
}
