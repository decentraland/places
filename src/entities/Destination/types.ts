import { AggregatePlaceAttributes, PlaceListOrderBy } from "../Place/types"

export type GetDestinationsListQuery = {
  limit: string
  offset: string
  positions: string[]
  world_names: string[]
  only_favorites: string
  only_highlighted: string
  order_by: string
  order: string
  with_realms_detail: string
  search: string
  categories: string[]
  owner?: string
  creator_address?: string
  only_worlds: string
  only_places: string
}

export type DestinationsListOptions = {
  offset: number
  limit: number
  only_favorites: boolean
  only_highlighted: boolean
  positions: string[]
  world_names: string[]
  order_by: string
  order: string
  search: string
  categories: string[]
  owner?: string
  creator_address?: string
  only_worlds: boolean
  only_places: boolean
}

export type FindDestinationsWithAggregatesOptions = DestinationsListOptions & {
  user?: string
  operatedPositions?: string[]
}

/**
 * Query parameters for the unified destinations endpoint
 * Supports filtering by coordinates (exact match), names (LIKE), search, SDK, and more
 */
export type GetUnifiedDestinationsListQuery = {
  limit: string
  offset: string
  /** Filter places by exact coordinates (e.g., "10,20") */
  positions: string[]
  /** Filter worlds by name using LIKE matching */
  names: string[]
  only_favorites: string
  only_highlighted: string
  order_by: string
  order: string
  with_realms_detail: string
  /** Full-text search across title, description, and owner */
  search: string
  categories: string[]
  owner?: string
  creator_address?: string
  only_worlds: string
  only_places: string
  /** Filter by SDK version (exact match) */
  sdk?: string
}

/**
 * Options for unified destinations query
 */
export type UnifiedDestinationsListOptions = {
  offset: number
  limit: number
  only_favorites: boolean
  only_highlighted: boolean
  /** Filter places by exact coordinates */
  positions: string[]
  /** Filter worlds by name using LIKE matching */
  names: string[]
  order_by: string
  order: string
  search: string
  categories: string[]
  owner?: string
  creator_address?: string
  only_worlds: boolean
  only_places: boolean
  /** Filter by SDK version (exact match) */
  sdk?: string
}

export type FindUnifiedDestinationsOptions = UnifiedDestinationsListOptions & {
  user?: string
  operatedPositions?: string[]
  hotScenesPositions?: string[]
}

export { PlaceListOrderBy as DestinationsListOrderBy }

export type DestinationAttributes = AggregatePlaceAttributes
