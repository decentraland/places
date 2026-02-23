import { PlaceListOrderBy, Realm } from "../Place/types"
import { BaseEntityAttributes } from "../shared/types"

/**
 * DestinationAttributes: the unified shape returned by the destinations API.
 * All fields are required (with defaults for the entity type that doesn't naturally have them)
 * to preserve backward compatibility.
 *
 * Excluded (strictly internal, never returned):
 *   textsearch, world_id, single_player, skybox_time, show_in_places
 */
export type DestinationAttributes = BaseEntityAttributes & {
  base_position: string
  contact_name: string | null
  deployed_at: Date | null
  highlighted: boolean
  world: boolean
  is_private: boolean
  highlighted_image: string | null
  positions: string[]
  contact_email: string | null
  creator_address: string | null
  sdk: string | null
  ranking: number | null
}

export type AggregateDestinationAttributes = DestinationAttributes & {
  user_like: boolean
  user_dislike: boolean
  user_favorite: boolean
  user_count?: number
  user_visits: number
  realms_detail?: Realm[]
}

/**
 * Common filter fields shared between query and internal options
 */
type CommonFilterFields = {
  world_names: string[]
  names: string[]
  order_by: string
  order: string
  search: string
  categories: string[]
  owner?: string
  creator_address?: string
  sdk?: string
}

/**
 * Query parameters (strings from URL) - uses 'pointer' for public API
 */
export type GetDestinationsListQuery = CommonFilterFields & {
  pointer: string[]
  limit: string
  offset: string
  only_favorites: string
  only_highlighted: string
  only_worlds: string
  only_places: string
  with_realms_detail: string
  with_connected_users: string
  with_live_events: string
}

/**
 * Parsed options (proper types) - uses 'positions' for internal model compatibility
 */
export type DestinationsListOptions = CommonFilterFields & {
  positions: string[]
  offset: number
  limit: number
  only_favorites: boolean
  only_highlighted: boolean
  only_worlds: boolean
  only_places: boolean
}

export type FindDestinationsWithAggregatesOptions = DestinationsListOptions & {
  user?: string
  operatedPositions?: string[]
  hotScenesPositions?: string[]
  ids?: string[]
}

/**
 * Client-side options for the Destinations API.
 * Field names match the URL query parameters accepted by the /destinations endpoint.
 */
export type DestinationListClientOptions = {
  pointer?: string[]
  world_names?: string[]
  names?: string[]
  limit?: number
  offset?: number
  only_favorites?: boolean
  only_highlighted?: boolean
  only_worlds?: boolean
  only_places?: boolean
  order_by?: string
  order?: string
  search?: string
  categories?: string[]
  owner?: string
  creator_address?: string
  sdk?: string
  with_realms_detail?: boolean
  with_connected_users?: boolean
  with_live_events?: boolean
}

export { PlaceListOrderBy as DestinationsListOrderBy }
