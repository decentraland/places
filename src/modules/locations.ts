import {
  bool,
  numeric,
  oneOf,
} from "decentraland-gatsby/dist/entities/Schema/utils"
import API from "decentraland-gatsby/dist/utils/api/API"

import { getPlaceListQuerySchema } from "../entities/Place/schemas"
import { PlaceListOrderBy } from "../entities/Place/types"
import { getWorldListQuerySchema } from "../entities/World/schemas"
import { WorldListOrderBy } from "../entities/World/types"
import toCanonicalPosition from "../utils/position/toCanonicalPosition"

const GATSBY_BASE_URL = process.env.GATSBY_BASE_URL || "/"

export type PlacesPageOptions = {
  only_pois: boolean
  only_favorites: boolean
  only_featured: boolean
  only_highlighted: boolean
  order_by: PlaceListOrderBy
  order: "asc" | "desc"
  page: number
  search: string
}

export type WorldsPageOptions = {
  only_favorites: boolean
  order_by: WorldListOrderBy
  order: "asc" | "desc"
  page: number
  search: string
}

const pageOptionsDefault: PlacesPageOptions = {
  only_favorites: false,
  only_pois: false,
  only_featured: false,
  only_highlighted: false,
  order_by: PlaceListOrderBy.MOST_ACTIVE,
  order: "desc",
  page: 1,
  search: "",
}

const pageWorldsOptionsDefault: WorldsPageOptions = {
  only_favorites: false,
  order_by: WorldListOrderBy.LIKE_SCORE_BEST,
  order: "desc",
  page: 1,
  search: "",
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
    search: params.get("search") ?? "",
  }
}

export function toWorldsOptions(params: URLSearchParams): WorldsPageOptions {
  return {
    only_favorites:
      bool(params.get("only_favorites")) ?? pageOptionsDefault.only_favorites,
    order_by:
      oneOf(
        params.get("order_by"),
        getWorldListQuerySchema.properties.order_by.enum
      ) ?? WorldListOrderBy.LIKE_SCORE_BEST,
    order:
      oneOf(params.get("order"), ["asc", "desc"]) ?? pageOptionsDefault.order,
    page: numeric(params.get("page"), { min: 1 }) ?? pageOptionsDefault.page,
    search: params.get("search") ?? "",
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

export function fromWorldsOptions(
  options: Partial<WorldsPageOptions>
): URLSearchParams {
  const params = API.searchParams(options)
  for (const param of Object.keys(
    pageWorldsOptionsDefault
  ) as (keyof WorldsPageOptions)[]) {
    if (options[param] === pageWorldsOptionsDefault[param]) {
      params.delete(param)
    }
  }

  return params
}

export default {
  home: () => API.url(GATSBY_BASE_URL, "/"),
  place: (position: string) => {
    const canonicalPosition = toCanonicalPosition(position)!
    return API.url(GATSBY_BASE_URL, "/place/", { position: canonicalPosition })
  },
  world: (name: string) => {
    return API.url(GATSBY_BASE_URL, "/world/", { name: name })
  },
  places: (options: Partial<PlacesPageOptions>) =>
    API.url(GATSBY_BASE_URL, "/places/", fromPlacesOptions(options)),
  worlds: (options: Partial<WorldsPageOptions>) =>
    API.url(GATSBY_BASE_URL, "/worlds/", fromWorldsOptions(options)),
  favorites: () => API.url(GATSBY_BASE_URL, "/favorites/"),
  favoritesPlaces: (options: Partial<PlacesPageOptions>) =>
    API.url(GATSBY_BASE_URL, "/favorites/places", fromPlacesOptions(options)),
  favoritesWorlds: (options: Partial<PlacesPageOptions>) =>
    API.url(GATSBY_BASE_URL, "/favorites/worlds", fromPlacesOptions(options)),
  docs: () => API.url("/docs/"),
}
