import API from "decentraland-gatsby/dist/utils/api/API"
import Options from "decentraland-gatsby/dist/utils/api/Options"
import Time from "decentraland-gatsby/dist/utils/date/Time"
import env from "decentraland-gatsby/dist/utils/env"

import { AggregatePlaceAttributes } from "../entities/Place/types"
import { UpdateUserFavoriteResponse } from "../entities/UserFavorite/types"
import { UpdateUserLikeResponse } from "../entities/UserLikes/types"

export default class Places extends API {
  static Url =
    process.env.GATSBY_PLACES_URL || `https://places.decentraland.org/api`

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
      deployed_at: Time.date(place.deployed_at),
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

  async getLike(placeId: string) {
    return this.fetch<UpdateUserLikeResponse>(
      `/places/${placeId}/likes`,
      this.options({ method: "GET" }).authorization({
        sign: true,
      })
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
}
