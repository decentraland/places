import { SQLStatement } from "decentraland-gatsby/dist/entities/Database/utils"
import {
  HotScene as CatalystHotScene,
  Realm as CatalystRealm,
  SceneContentRating,
} from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { BaseAggregateAttributes, BaseEntityAttributes } from "../shared/types"

export type Permission = {
  id: string
  x: string
  y: string
  owner: string
  updateOperator: string
}

export type Paginated<T> = {
  totalAmount: number
  pageNum: number
  pageSize: number
  elements: T[]
}

// NOTE: this is slightly different from the catalyst response
export type Realm = Pick<CatalystRealm, "serverName" | "usersCount">

// NOTE: this is slightly different from the catalyst response
export type HotScene = Pick<
  CatalystHotScene,
  "id" | "name" | "baseCoords" | "usersTotalCount" | "parcels"
> & {
  realms: Realm[]
}

/**
 * Place-specific attributes that extend the base entity.
 * Note: world_name is inherited from BaseEntityAttributes.
 */
export type PlaceAttributes = BaseEntityAttributes & {
  highlighted_image: string | null
  positions: string[]
  base_position: string
  contact_name: string | null
  contact_email: string | null
  highlighted: boolean
  world: boolean
  /** Foreign key to the worlds table for world scenes */
  world_id: string | null
  deployed_at: Date
  textsearch: SQLStatement | string | null | undefined
  creator_address: string | null
  /** SDK/runtime version of the scene from scene.json runtimeVersion field (e.g., "7" for SDK7) */
  sdk: string | null
  /** Ranking score for ordering places */
  ranking: number | null
}

/**
 * Place attributes with user-specific aggregate data.
 * Inherits common aggregate properties from BaseAggregateAttributes.
 */
export type AggregatePlaceAttributes = PlaceAttributes &
  BaseAggregateAttributes & {
    realms_detail?: Realm[]
    /** Whether this destination is private (only applicable to worlds, false for genesis places) */
    is_private?: boolean
  }

export type GetPlaceParams = {
  place_id: string
}

export enum PlaceListOrderBy {
  MOST_ACTIVE = "most_active",
  LIKE_SCORE_BEST = "like_score",
  UPDATED_AT = "updated_at",
  USER_VISITS = "user_visits",
  CREATED_AT = "created_at",
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
  owner?: string
  creator_address?: string
  sdk?: string
  names?: string[]
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
  owner?: string
  creator_address?: string
  sdk?: string
  names?: string[]
}

export type FindWithAggregatesOptions = PlaceListOptions & {
  user?: string
  hotScenesPositions?: string[]
  ids?: string[]
  operatedPositions?: string[]
}

export const unwantedThumbnailHash = [
  "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
  "QmdfTbBqBPQ7VNxZEYEj14VmRuZBkqFbiwReogJgS1zR1n",
]

export type UpdateRatingBody = {
  content_rating: SceneContentRating
  comment?: string
}

export type UpdateRankingBody = {
  ranking: number | null
}

export type UpdateHighlightBody = {
  highlighted: boolean
}
