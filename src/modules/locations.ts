import {
  bool,
  numeric,
  oneOf,
} from "decentraland-gatsby/dist/entities/Schema/utils"
import API from "decentraland-gatsby/dist/utils/api/API"

import { getPlaceListQuerySchema } from "../entities/Place/schemas"
import { PlaceListOrderBy } from "../entities/Place/types"

const GATSBY_BASE_URL = process.env.GATSBY_BASE_URL || "/"

export type PlacesPageOptions = {
  only_pois: boolean
  only_favorites: boolean
  only_featured: boolean
  only_highlighted: boolean
  order_by: PlaceListOrderBy
  order: "asc" | "desc"
  page: number
}

const pageOptionsDefault: PlacesPageOptions = {
  only_favorites: false,
  only_pois: false,
  only_featured: false,
  only_highlighted: false,
  order_by: PlaceListOrderBy.HIGHEST_RATED,
  order: "desc",
  page: 1,
}

export function toPlacesOptions(params: URLSearchParams): PlacesPageOptions {
  return {
    only_pois: bool(params.get("only_pois")) ?? pageOptionsDefault.only_pois,
    only_featured:
      bool(params.get("only_featured")) ?? pageOptionsDefault.only_featured,
    only_highlighted:
      bool(params.get("only_highlighted")) ??
      pageOptionsDefault.only_highlighted,
    only_favorites:
      bool(params.get("only_favorites")) ?? pageOptionsDefault.only_favorites,
    order_by:
      oneOf(
        params.get("order_by"),
        getPlaceListQuerySchema.properties.order_by.enum
      ) ?? pageOptionsDefault.order_by,
    order:
      oneOf(params.get("order"), ["asc", "desc"]) ?? pageOptionsDefault.order,
    page: numeric(params.get("page"), { min: 1 }) ?? pageOptionsDefault.page,
  }
}

export function fromPlacesOptions(
  options: Partial<PlacesPageOptions>
): URLSearchParams {
  const params = API.searchParams(options)
  for (const param of Object.keys(
    pageOptionsDefault
  ) as (keyof PlacesPageOptions)[]) {
    if (options[param] === pageOptionsDefault[param]) {
      params.delete(param)
    }
  }

  return params
}

export default {
  home: () => API.url(GATSBY_BASE_URL, "/"),
  place: (position: string) =>
    API.url(GATSBY_BASE_URL, "/place/", { position }),
  places: (options: Partial<PlacesPageOptions>) =>
    API.url(GATSBY_BASE_URL, "/places/", fromPlacesOptions(options)),
  my_places: (options: Partial<PlacesPageOptions>) =>
    API.url(GATSBY_BASE_URL, "/my_places/", fromPlacesOptions(options)),
}
