import API from "decentraland-gatsby/dist/utils/api/API"
import Options from "decentraland-gatsby/dist/utils/api/Options"
import Time from "decentraland-gatsby/dist/utils/date/Time"
import env from "decentraland-gatsby/dist/utils/env"

import {
  AggregateDestinationAttributes,
  DestinationListClientOptions,
  DestinationsListOrderBy,
} from "../entities/Destination/types"
import { DecentralandCategories } from "../entities/Category/types"

export default class Destinations extends API {
  static Url = env(`PLACES_URL`, `https://places.decentraland.org/api`)

  static Cache = new Map<string, Destinations>()

  static from(url: string) {
    if (!this.Cache.has(url)) {
      this.Cache.set(url, new Destinations(url))
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

  async getDestinations(options?: DestinationListClientOptions) {
    const query = options ? API.searchParams(options).toString() : ""
    const result = await super.fetch<{
      ok: true
      data: AggregateDestinationAttributes[]
      total: number
    }>(
      `/destinations?${query}`,
      this.options().authorization({ sign: true, optional: true })
    )

    return {
      ...result,
      data: result.data.map(
        Destinations.parse<AggregateDestinationAttributes>
      ),
      total: Number(result.total),
    }
  }

  async getDestinationsHighlighted(options?: {
    limit: number
    offset: number
  }) {
    return this.getDestinations({
      only_highlighted: true,
      ...options,
    })
  }

  async getDestinationsRecentlyUpdated(options?: {
    limit: number
    offset: number
  }) {
    return this.getDestinations({
      order_by: DestinationsListOrderBy.UPDATED_AT,
      order: "desc",
      ...options,
    })
  }

  async getDestinationsHighRated(options?: { limit: number; offset: number }) {
    return this.getDestinations({
      order_by: DestinationsListOrderBy.LIKE_SCORE_BEST,
      order: "desc",
      ...options,
    })
  }

  async getDestinationsMostActive(options?: {
    limit: number
    offset: number
  }) {
    return this.getDestinations({
      order_by: DestinationsListOrderBy.MOST_ACTIVE,
      order: "desc",
      ...options,
    })
  }

  async getDestinationsFeatured(options?: { limit: number; offset: number }) {
    return this.getDestinations({
      ...options,
      categories: [DecentralandCategories.FEATURED],
    })
  }

  async getDestinationsMyFavorites(options?: {
    limit: number
    offset: number
    search?: string
  }) {
    return this.getDestinations({ only_favorites: true, ...options })
  }
}
