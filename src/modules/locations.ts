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
  only_favorites: boolean
  only_highlighted: boolean
  order_by: PlaceListOrderBy
  order: "asc" | "desc"
  page: number
  search: string
  categories: string[]
  only_view_category: string
}

export type WorldsPageOptions = {
  only_favorites: boolean
  order_by: WorldListOrderBy
  order: "asc" | "desc"
  page: number
  search: string
  categories: string[]
  only_view_category: string
}

const pageOptionsDefault: PlacesPageOptions = {
  only_favorites: false,
  only_highlighted: false,
  order_by: PlaceListOrderBy.MOST_ACTIVE,
  order: "desc",
  page: 1,
  search: "",
  categories: [],
  only_view_category: "",
}

const pageWorldsOptionsDefault: WorldsPageOptions = {
  only_favorites: false,
  order_by: WorldListOrderBy.LIKE_SCORE_BEST,
  order: "desc",
  page: 1,
  search: "",
  categories: [],
  only_view_category: "",
}

export function toPlacesOptions(params: URLSearchParams): PlacesPageOptions {
  return {
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
    categories: [...new Set(params.getAll("categories"))] ?? [],
    only_view_category: params.get("only_view_category") ?? "",
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
    categories: [...new Set(params.getAll("categories"))] ?? [],
    only_view_category: params.get("only_view_category") ?? "",
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

    const params: Record<string, string> = {
      position: canonicalPosition,
    }

    return API.url(GATSBY_BASE_URL, "/place/", params)
  },
  world: (name: string) => {
    return API.url(GATSBY_BASE_URL, "/world/", { name: name })
  },
  genesis: (options: Partial<PlacesPageOptions>) =>
    API.url(GATSBY_BASE_URL, "/genesis/", fromPlacesOptions(options)),
  worlds: (options: Partial<WorldsPageOptions>) =>
    API.url(GATSBY_BASE_URL, "/worlds/", fromWorldsOptions(options)),
  favorites: () => API.url(GATSBY_BASE_URL, "/favorites/"),
  favoritesPlaces: (options: Partial<PlacesPageOptions>) =>
    API.url(GATSBY_BASE_URL, "/favorites/places", fromPlacesOptions(options)),
  favoritesWorlds: (options: Partial<PlacesPageOptions>) =>
    API.url(GATSBY_BASE_URL, "/favorites/worlds", fromPlacesOptions(options)),
  docs: () => API.url("/docs/"),
}
