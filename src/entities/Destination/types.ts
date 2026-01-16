import { AggregatePlaceAttributes, PlaceListOrderBy } from "../Place/types"

/**
 * Common destination filter fields (same types in query and options)
 */
type BaseDestinationFields = {
  positions: string[]
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
 * Query parameters (strings from URL)
 */
export type GetDestinationsListQuery = BaseDestinationFields & {
  limit: string
  offset: string
  only_favorites: string
  only_highlighted: string
  only_worlds: string
  only_places: string
  with_realms_detail: string
  with_connected_users: string
}

/**
 * Parsed options (proper types)
 */
export type DestinationsListOptions = BaseDestinationFields & {
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
}

export { PlaceListOrderBy as DestinationsListOrderBy }

export type DestinationAttributes = AggregatePlaceAttributes
