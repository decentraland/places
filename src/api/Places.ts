import API from "decentraland-gatsby/dist/utils/api/API"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import Options from "decentraland-gatsby/dist/utils/api/Options"
import Time from "decentraland-gatsby/dist/utils/date/Time"
import env from "decentraland-gatsby/dist/utils/env"

import {
  CategoryCountTargetOptions,
  DecentralandCategories,
} from "../entities/Category/types"
import {
  AggregatePlaceAttributes,
  PlaceListOptions,
  PlaceListOrderBy,
} from "../entities/Place/types"
import { UpdateUserFavoriteResponse } from "../entities/UserFavorite/types"
import { UpdateUserLikeResponse } from "../entities/UserLikes/types"
import {
  AggregateWorldAttributes,
  WorldListOptions,
} from "../entities/World/types"

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

  static parse<
    T extends {
      created_at: Date
      updated_at: Date
      disabled_at: Date | null
      disabled: boolean
    }
  >(entity: T): T {
    return {
      ...entity,
      created_at: Time.date(entity.created_at),
      updated_at: Time.date(entity.updated_at),
      disabled_at: Time.date(entity.disabled_at),
      disabled: Boolean(entity.disabled),
    } as T
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
    return (result || []).map(Places.parse<AggregatePlaceAttributes>)
  }

  async fetchOne(
    url: string,
    options: Options = new Options({})
  ): Promise<AggregatePlaceAttributes> {
    const result = (await this.fetch(url, options)) as any
    return Places.parse<AggregatePlaceAttributes>(result)
  }

  async getPlaceById(placeId: string) {
    return this.fetchOne(
      `/places/${placeId}`,
      this.options().authorization({ sign: true, optional: true })
    )
  }

  async getWorldById(worldId: string) {
    const result = (await this.fetch(
      `/worlds/${worldId}`,
      this.options().authorization({ sign: true, optional: true })
    )) as AggregateWorldAttributes
    return Places.parse<AggregateWorldAttributes>(result)
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
      data: result.data.map(Places.parse<AggregatePlaceAttributes>),
      total: Number(result.total),
    }
  }

  async getPlacesRecentlyUpdates(options?: { limit: number; offset: number }) {
    return this.getPlaces({ order_by: "updated_at", order: "desc", ...options })
  }

  async getPlacesHightRated(options?: { limit: number; offset: number }) {
    return this.getPlaces({
      order_by: PlaceListOrderBy.LIKE_SCORE_BEST,
      order: "desc",
      ...options,
    })
  }

  async getPlacesMyFavorites(options?: {
    limit: number
    offset: number
    search?: string
  }) {
    return this.getPlaces({ only_favorites: true, ...options })
  }

  async getPlacesMostActive(options?: { limit: number; offset: number }) {
    return this.getPlaces({
      order_by: PlaceListOrderBy.MOST_ACTIVE,
      order: "desc",
      ...options,
    })
  }

  async getPlacesFeatured(options?: { limit: number; offset: number }) {
    return this.getPlaces({
      ...options,
      categories: [DecentralandCategories.FEATURED],
    })
  }

  async getPlacesHighlighted(options?: { limit: number; offset: number }) {
    return this.getPlaces({
      only_highlighted: true,
      ...options,
    })
  }

  async getWorlds(options?: Partial<WorldListOptions>) {
    const query = options ? API.searchParams(options).toString() : ""
    const result = await super.fetch<{
      ok: true
      data: AggregateWorldAttributes[]
      total: number
    }>(
      `/worlds?${query}`,
      this.options().authorization({ sign: true, optional: true })
    )

    return {
      ...result,
      data: result.data.map(Places.parse<AggregateWorldAttributes>),
      total: Number(result.total),
    }
  }

  async getWorldsMyFavorites(options?: {
    limit: number
    offset: number
    search?: string
  }) {
    return this.getWorlds({ only_favorites: true, ...options })
  }

  async updateWorldFavorite(worldId: string, favorites: boolean) {
    return this.fetch<UpdateUserFavoriteResponse>(
      `/worlds/${worldId}/favorites`,
      this.options({ method: "PATCH" })
        .json({ favorites })
        .authorization({ sign: true })
    )
  }

  async updateWorldLike(worldId: string, like: boolean | null) {
    return this.fetch<UpdateUserLikeResponse>(
      `/worlds/${worldId}/likes`,
      this.options({ method: "PATCH" })
        .json({ like })
        .authorization({ sign: true })
    )
  }

  async updateWorldRating(
    worldId: string,
    params: { content_rating: SceneContentRating; comment?: string }
  ) {
    return this.fetch<AggregateWorldAttributes>(
      `/worlds/${worldId}/rating`,
      this.options({ method: "PUT" }).json(params).authorization({ sign: true })
    )
  }

  async updateRating(
    placeId: string,
    params: { content_rating: SceneContentRating; comment?: string }
  ) {
    return this.fetch<UpdateUserFavoriteResponse>(
      `/places/${placeId}/rating`,
      this.options({ method: "PUT" }).json(params).authorization({ sign: true })
    )
  }

  async updateHighlight(placeId: string, highlighted: boolean) {
    return this.fetch<AggregatePlaceAttributes>(
      `/places/${placeId}/highlight`,
      this.options({ method: "PUT" })
        .json({ highlighted })
        .authorization({ sign: true })
    )
  }

  async getCategories(
    target: CategoryCountTargetOptions = CategoryCountTargetOptions.ALL
  ) {
    const result = await super.fetch<{
      ok: boolean
      data: { name: string; count: number }[]
    }>(`/categories?target=${target}`)

    return result.data
  }

  async getPlaceCategories(placeId: string) {
    const result = await super.fetch<{
      ok: boolean
      data: { categories: string[] }
    }>(`/places/${placeId}/categories`)

    return result.data
  }
}
