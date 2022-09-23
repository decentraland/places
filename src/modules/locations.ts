import {
  bool,
  numeric,
  oneOf,
} from "decentraland-gatsby/dist/entities/Schema/utils"
import API from "decentraland-gatsby/dist/utils/api/API"

const GATSBY_BASE_URL = process.env.GATSBY_BASE_URL || "/"

export enum PlacesOrderBy {
  Popularity = "popularity",
  UpdatedAt = "updated_at",
}

export type PlacesPageOptions = {
  only_pois: boolean
  only_favorites: boolean
  order_by: PlacesOrderBy
  order: "asc" | "desc"
  page: number
}

export function toPlacesOptions(params: URLSearchParams): PlacesPageOptions {
  return {
    only_pois: bool(params.get("only_pois")) ?? false,
    only_favorites: bool(params.get("only_favorites")) ?? false,
    order_by:
      oneOf(params.get("order_by"), [
        PlacesOrderBy.Popularity,
        PlacesOrderBy.UpdatedAt,
      ]) ?? PlacesOrderBy.UpdatedAt,
    order: oneOf(params.get("order"), ["asc", "desc"]) ?? "desc",
    page: numeric(params.get("page"), { min: 1 }) ?? 1,
  }
}

export function fromPlacesOptions(
  options: Partial<PlacesPageOptions>
): URLSearchParams {
  const params = API.searchParams(options)
  if (options.only_pois !== true) {
    params.delete("only_pois")
  }

  if (!Number.isFinite(options.page) || options.page! <= 1) {
    params.delete("page")
  }

  return params
}

export default {
  home: () => API.url(GATSBY_BASE_URL, "/"),
  place: (id: string) => API.url(GATSBY_BASE_URL, "/place/", { id }),
  places: (options: Partial<PlacesPageOptions>) =>
    API.url(GATSBY_BASE_URL, "/places/", fromPlacesOptions(options)),
  my_places: () => API.url(GATSBY_BASE_URL, "/my_places/"),
}
