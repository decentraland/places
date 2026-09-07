import {
  AggregatePlaceAttributes,
  GetPlaceListQuery,
  PlaceListOptions,
} from "../Place/types"

export type AggregateCoordinatePlaceAttributes = Pick<
  AggregatePlaceAttributes,
  | "id"
  | "base_position"
  | "title"
  | "description"
  | "image"
  | "contact_name"
  | "categories"
  | "user_favorite"
  | "user_like"
  | "user_dislike"
  | "user_visits"
  | "user_count"
  | "realms_detail"
> & {
  positions?: string[]
}

// The map draws every parcel, so it has no use for the browse filters: `owner` narrows to one
// creator and `only_excluded_from_ranking` answers an editorial question about the feed.
export type GetAllPlaceListQuery = Omit<
  GetPlaceListQuery,
  "owner" | "only_excluded_from_ranking"
> & {
  names: string[]
}

export type AllPlacesListOptions = PlaceListOptions & {
  names: string[]
  sdk?: string
}

export type FindAllPlacesWithAggregatesOptions = AllPlacesListOptions & {
  user?: string
}

export const DEFAULT_MAX_LIMIT = 500
