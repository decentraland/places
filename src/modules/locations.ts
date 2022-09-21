import API from "decentraland-gatsby/dist/utils/api/API"

const GATSBY_BASE_URL = process.env.GATSBY_BASE_URL || "/"

export enum PlacesOrderBy {
  Popularity = "popularity",
  UpdatedAt = "update_at",
}

export type PlacesPageOptions = {
  postions?: string[]
  orderBy?: PlacesOrderBy
}

export function toPlacesOptions(params: URLSearchParams): PlacesPageOptions {
  return {}
}

export function fromPlacesOptions(options: PlacesPageOptions): URLSearchParams {
  API.searchParams
  const params = new URLSearchParams()
  return params
}

export default {
  home: () => API.url(GATSBY_BASE_URL, "/"),
  place: (id: string) => API.url(GATSBY_BASE_URL, "/place/", { id }),
  places: (options: PlacesPageOptions) =>
    API.url(GATSBY_BASE_URL, "/places/", fromPlacesOptions(options)),
}
