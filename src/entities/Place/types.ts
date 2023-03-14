import { Realm } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

export type PlaceAttributes = {
  id: string
  title: string | null
  description: string | null
  image: string | null
  highlighted_image: string | null
  featured_image: string | null
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
  like_rate: number
  highlighted: boolean
  featured: boolean
  disabled: boolean
  disabled_at: Date | null
  visible: boolean
  created_at: Date
  updated_at: Date
}

export type AggregatePlaceAttributes = PlaceAttributes & {
  user_like: boolean
  user_dislike: boolean
  user_favorite: boolean
  user_count?: number
  user_visits?: number
  last_deployed_at?: Date
  realms_detail?: Realm[]
}

export type GetPlaceParams = {
  place_id: string
}

export enum PlaceListOrderBy {
  MOST_ACTIVE = "most_active",
  HIGHEST_RATED = "like_rate",
  UPDATED_AT = "updated_at",
  USER_VISITS = "user_visits",
}

export type GetPlaceListQuery = {
  limit: string
  offset: string
  positions: string[]
  only_favorites: string
  only_featured: string
  only_highlighted: string
  order_by: string
  order: string
  with_realms_detail: string
}

export type PlaceListOptions = {
  offset: number
  limit: number
  only_favorites: boolean
  only_featured: boolean
  only_highlighted: boolean
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
