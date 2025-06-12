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
