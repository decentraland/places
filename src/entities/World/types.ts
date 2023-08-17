export type GetWorldListQuery = {
  limit: string
  offset: string
  names: string[]
  only_favorites: string
  order_by: string
  order: string
  search: string
}

export enum WorldListOrderBy {
  HIGHEST_RATED_LOWER_BOUND_SCORE = "like_score",
  MOST_ACTIVE = "most_active",
}

export type WorldListOptions = {
  offset: number
  limit: number
  only_favorites: boolean
  names: string[]
  order_by: string
  order: string
  search: string
}

export type FindWorldWithAggregatesOptions = WorldListOptions & {
  user?: string
}
