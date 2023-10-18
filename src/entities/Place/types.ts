import { SQLStatement } from "decentraland-gatsby/dist/entities/Database/utils"
import {
  HotScene as CatalystHotScene,
  Realm as CatalystRealm,
  SceneContentRating,
} from "decentraland-gatsby/dist/utils/api/Catalyst.types"

// NOTE: this is slightly different from the catalyst response
export type Realm = Pick<CatalystRealm, "serverName" | "usersCount">

// NOTE: this is slightly different from the catalyst response
export type HotScene = Pick<
  CatalystHotScene,
  "id" | "name" | "baseCoords" | "usersTotalCount" | "parcels"
> & {
  realms: Realm[]
}

export type PlaceAttributes = {
  id: string
  title: string | null
  description: string | null
  image: string | null
  highlighted_image: string | null
  owner: string | null
  positions: string[]
  base_position: string
  contact_name: string | null
  contact_email: string | null
  content_rating: SceneContentRating
  likes: number
  dislikes: number
  favorites: number
  like_rate: number | null
  like_score: number | null
  highlighted: boolean
  disabled: boolean
  disabled_at: Date | null
  created_at: Date
  updated_at: Date
  world: boolean
  world_name: string | null
  hidden: boolean
  deployed_at: Date
  textsearch: SQLStatement | string | null | undefined
  categories: string[]
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
  only_highlighted: string
  order_by: string
  order: string
  with_realms_detail: string
  search: string
  categories: string[]
}

export type PlaceListOptions = {
  offset: number
  limit: number
  only_favorites: boolean
  only_highlighted: boolean
  positions: string[]
  order_by: string
  order: string
  search: string
  categories: string[]
}

export type FindWithAggregatesOptions = PlaceListOptions & {
  user?: string
}

export const unwantedThumbnailHash = [
  "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
  "QmdfTbBqBPQ7VNxZEYEj14VmRuZBkqFbiwReogJgS1zR1n",
]

export type UpdateRatingBody = {
  content_rating: SceneContentRating
  comment?: string
}
