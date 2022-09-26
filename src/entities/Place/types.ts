export type PlaceAttributes = {
  id: string
  title: string | null
  description: string | null
  image: string | null
  owner: string | null
  tags: string[]
  positions: string[]
  base_position: string
  contact_name: string | null
  contact_email: string | null
  content_rating: string | null
  likes: number
  dislikes: number
  favorites: number
  deployed_at: Date
  disabled: boolean
  disabled_at: Date | null
  created_at: Date
  updated_at: Date
}

export type AggregatePlaceAttributes = PlaceAttributes & {
  user_like: boolean
  user_dislike: boolean
  user_favorite: boolean
}

export type GetPlaceParams = {
  place_id: string
}

export enum PlaceListOrderBy {
  POPULARITY = "popularity",
  UPDATED_AT = "updated_at",
}

export type GetPlaceListQuery = {
  limit: string
  offset: string
  positions: string[]
  onlyFavorites: string
  orderBy: string
  order: string
}

export type PlaceListOptions = {
  offset: number
  limit: number
  onlyFavorites: boolean
  positions: string[]
  orderBy: string
  order: string
}

export type FindWithAggregatesOptions = PlaceListOptions & {
  user?: string
}
