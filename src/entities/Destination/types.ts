import { AggregatePlaceAttributes, PlaceListOrderBy } from "../Place/types"

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

export { PlaceListOrderBy as DestinationsListOrderBy }

export type DestinationAttributes = AggregatePlaceAttributes
