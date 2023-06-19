export type GetWorldListQuery = {
  limit: string
  offset: string
  names: string[]
  only_favorites: string
  order_by: string
  order: string
}

export enum WorldListOrderBy {
  MOST_ACTIVE = "most_active",
  HIGHEST_RATED = "like_rate",
}

export type WorldListOptions = {
  offset: number
  limit: number
  only_favorites: boolean
  names: string[]
  order_by: string
  order: string
}

export type FindWorldWithAggregatesOptions = WorldListOptions & {
  user?: string
}