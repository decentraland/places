export type GetWorldListQuery = {
  limit: string
  offset: string
  names: string[]
  only_favorites: string
  order_by: string
  order: string
  search: string
  categories: string[]
}

export enum WorldListOrderBy {
  LIKE_SCORE_BEST = "like_score",
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
  categories: string[]
}

export type FindWorldWithAggregatesOptions = WorldListOptions & {
  user?: string
}
