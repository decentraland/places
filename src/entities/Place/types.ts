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

  activity_score: BigInt
  popularity_score: number

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
  ACTIVITY = "activity_score",
  POPULARITY = "popularity_score",
  UPDATED_AT = "updated_at",
}

export type GetPlaceListQuery = {
  limit: string
  offset: string
  positions: string[]
  only_favorites: string
  order_by: string
  order: string
}

export type PlaceListOptions = {
  offset: number
  limit: number
  only_favorites: boolean
  positions: string[]
  order_by: string
  order: string
}

export type FindWithAggregatesOptions = PlaceListOptions & {
  user?: string
}

export const unwantedThumbnailHash = [
  "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
  "QmdfTbBqBPQ7VNxZEYEj14VmRuZBkqFbiwReogJgS1zR1n",
]
