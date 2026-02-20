import API from "decentraland-gatsby/dist/utils/api/API"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import Options from "decentraland-gatsby/dist/utils/api/Options"
import Time from "decentraland-gatsby/dist/utils/date/Time"
import env from "decentraland-gatsby/dist/utils/env"

import { UpdateUserFavoriteResponse } from "../entities/UserFavorite/types"
import { UpdateUserLikeResponse } from "../entities/UserLikes/types"
import {
  AggregateWorldAttributes,
  WorldListOptions,
} from "../entities/World/types"

export default class Worlds extends API {
  static Url = env(`PLACES_URL`, `https://places.decentraland.org/api`)

  static Cache = new Map<string, Worlds>()

  static from(url: string) {
    if (!this.Cache.has(url)) {
      this.Cache.set(url, new Worlds(url))
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

  async getWorldById(worldId: string) {
    const result = (await this.fetch(
      `/worlds/${worldId}`,
      this.options().authorization({ sign: true, optional: true })
    )) as AggregateWorldAttributes
    return Worlds.parse<AggregateWorldAttributes>(result)
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
      data: result.data.map(Worlds.parse<AggregateWorldAttributes>),
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

  async updateHighlight(worldId: string, params: { highlighted: boolean }) {
    return this.fetch<AggregateWorldAttributes>(
      `/worlds/${worldId}/highlight`,
      this.options({ method: "PUT" }).json(params).authorization({ sign: true })
    )
  }
}
