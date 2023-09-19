import { SQLStatement } from "decentraland-gatsby/dist/entities/Database/utils"
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
  like_rate: number | null
  like_score: number | null
  highlighted: boolean
  featured: boolean
  disabled: boolean
  disabled_at: Date | null
  created_at: Date
  updated_at: Date
  categories: string[]
  world: boolean
  world_name: string | null
  hidden: boolean
  deployed_at: Date
  textsearch: SQLStatement | string | null | undefined
}

export type AggregatePlaceAttributes = PlaceAttributes & {
  user_like: boolean
  user_dislike: boolean
  user_favorite: boolean
  user_count?: number
  user_visits?: number
  realms_detail?: Realm[]
}

export type GetPlaceParams = {
  place_id: string
}

export enum PlaceListOrderBy {
  MOST_ACTIVE = "most_active",
  LIKE_SCORE_BEST = "like_score",
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
  search: string
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
  search: string
}

export type FindWithAggregatesOptions = PlaceListOptions & {
  user?: string
}

export const unwantedThumbnailHash = [
  "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
  "QmdfTbBqBPQ7VNxZEYEj14VmRuZBkqFbiwReogJgS1zR1n",
]

// TODO: verify rating categories
export enum PlaceRating {
  EVERYONE = "E",
  TEEN = "T",
  ADULT = "A",
  RESTRICTED = "R",
}

export type UpdateRatingBody = {
  content_rating: PlaceRating
}
