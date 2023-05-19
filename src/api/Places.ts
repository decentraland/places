import API from "decentraland-gatsby/dist/utils/api/API"
import Options from "decentraland-gatsby/dist/utils/api/Options"
import Time from "decentraland-gatsby/dist/utils/date/Time"
import env from "decentraland-gatsby/dist/utils/env"

import { Category } from "../components/Layout/CategoryList"
import {
  AggregatePlaceAttributes,
  PlaceListOptions,
} from "../entities/Place/types"
import { UpdateUserFavoriteResponse } from "../entities/UserFavorite/types"
import { UpdateUserLikeResponse } from "../entities/UserLikes/types"

const ATEAM = "https://places.dcl.guru/"

export default class Places extends API {
  static Url = env(`PLACES_URL`, `https://places.decentraland.org/api`)

  static Cache = new Map<string, Places>()

  static from(url: string) {
    if (!this.Cache.has(url)) {
      this.Cache.set(url, new Places(url))
    }

    return this.Cache.get(url)!
  }

  static get() {
    return this.from(env("PLACES_URL", this.Url))
  }

  static parsePlace(place: AggregatePlaceAttributes): AggregatePlaceAttributes {
    return {
      ...place,
      created_at: Time.date(place.created_at),
      updated_at: Time.date(place.updated_at),
      disabled_at: Time.date(place.disabled_at),
      disabled: Boolean(place.disabled),
    } as AggregatePlaceAttributes
  }

  async fetch<T extends Record<string, any>>(
    url: string,
    options: Options = new Options({})
  ) {
    const result = await super.fetch<{ ok: boolean; data: T }>(url, options)
    return result.data
  }

  async fetchMany(
    url: string,
    options: Options = new Options({})
  ): Promise<AggregatePlaceAttributes[]> {
    const result = (await this.fetch(url, options)) as any
    return (result || []).map(Places.parsePlace)
  }

  async fetchOne(
    url: string,
    options: Options = new Options({})
  ): Promise<AggregatePlaceAttributes> {
    const result = (await this.fetch(url, options)) as any
    return Places.parsePlace(result)
  }

  async getPlaceById(placeId: string) {
    return this.fetchOne(
      `/places/${placeId}`,
      this.options().authorization({ sign: true, optional: true })
    )
  }

  async updateFavorite(placeId: string, favorites: boolean) {
    return this.fetch<UpdateUserFavoriteResponse>(
      `/places/${placeId}/favorites`,
      this.options({ method: "PATCH" })
        .json({ favorites })
        .authorization({ sign: true })
    )
  }

  async updateLike(placeId: string, like: boolean | null) {
    return this.fetch<UpdateUserLikeResponse>(
      `/places/${placeId}/likes`,
      this.options({ method: "PATCH" })
        .json({ like })
        .authorization({ sign: true })
    )
  }

  async deleteLike(placeId: string) {
    return this.fetch<UpdateUserLikeResponse>(
      `/places/${placeId}/likes`,
      this.options({ method: "DELETE" }).authorization({
        sign: true,
      })
    )
  }

  async getPlaces(options?: Partial<PlaceListOptions>) {
    const query = options ? API.searchParams(options).toString() : ""
    const result = await super.fetch<{
      ok: true
      data: AggregatePlaceAttributes[]
      total: number
    }>(
      `/places?${query}`,
      this.options().authorization({ sign: true, optional: true })
    )

    return {
      ...result,
      data: result.data.map(Places.parsePlace),
      total: Number(result.total),
    }
  }

  async getPlacesRecentlyUpdates(options?: { limit: number; offset: number }) {
    return this.getPlaces({ order_by: "updated_at", order: "desc", ...options })
  }

  async getPlacesHightRated(options?: { limit: number; offset: number }) {
    return this.getPlaces({
      order_by: "like_rate",
      order: "desc",
      ...options,
    })
  }

  async getPlacesMyFavorites(options?: { limit: number; offset: number }) {
    return this.getPlaces({ only_favorites: true, ...options })
  }

  async getPlacesMostActive(options?: { limit: number; offset: number }) {
    return this.getPlaces({
      order_by: "most_active",
      order: "desc",
      ...options,
    })
  }

  async getPlacesFeatured(options?: { limit: number; offset: number }) {
    return this.getPlaces({
      only_featured: true,
      ...options,
    })
  }

  async getPlacesHighlighted(options?: { limit: number; offset: number }) {
    return this.getPlaces({
      only_highlighted: true,
      ...options,
    })
  }

  //This endpoint checks if user has visited the world checking the visited places by the user, 200 response means the user has used the world.
  //Other responses means the user is new or does not exist
  async getUserHasUsedWorld(account: string) {
    let result = {}
    await fetch(`${ATEAM}user/${account}`).then((res) =>
      res.status === 200 ? (result = true) : (result = false)
    )

    return result
  }

  //This endpoinds gets the category of common places to visit, we're displaying categories when the user has no recommended places to visit
  async getCategories() {
    let result: Category[] = []
    await fetch(`${ATEAM}category`)
      .then((response) => response.json())
      .then((responseBody) => {
        result = responseBody
      })

    return result
  }

  //This endpoinds gets the data from the category
  async getCategoryFromId(id: string) {
    let result = {}
    await fetch(`${ATEAM}category/${id}`)
      .then((response) => response.json())
      .then((responseBody) => {
        result = responseBody
      })

    return result
  }

  //This endpoinds gets the data from the category
  async getRecommendations(address: string) {
    let result = {}
    await fetch(
      `https://places.dcl.guru/user/0xd4fec88a49eb514e9347ec655d0481d8483a9ae0/recommendation`
    )
      .then((response) => response.json())
      .then((responseBody) => {
        result = responseBody
      })

    return result
  }
}
