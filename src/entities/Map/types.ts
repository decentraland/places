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

export type GetAllPlaceListQuery = Omit<GetPlaceListQuery, "owner"> & {
  names: string[]
}

export type AllPlacesListOptions = PlaceListOptions & {
  names: string[]
}

export type FindAllPlacesWithAggregatesOptions = AllPlacesListOptions & {
  user?: string
}

export const DEFAULT_MAX_LIMIT = 500
