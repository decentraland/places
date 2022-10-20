import { Model } from "decentraland-gatsby/dist/entities/Database/model"
import {
  SQL,
  conditional,
  limit,
  offset,
  table,
  values,
} from "decentraland-gatsby/dist/entities/Database/utils"
import { numeric, oneOf } from "decentraland-gatsby/dist/entities/Schema/utils"
import { HotScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import isEthereumAddress from "validator/lib/isEthereumAddress"

import EntityPlaceModel from "../EntityPlace/model"
import PlaceActivityDailyModel from "../PlaceActivityDaily/model"
import UserFavoriteModel from "../UserFavorite/model"
import UserLikesModel from "../UserLikes/model"
import {
  AggregatePlaceAttributes,
  FindWithAggregatesOptions,
  PlaceAttributes,
  PlaceListOrderBy,
} from "./types"

export const MIN_USER_ACTIVITY = 100
export const SUMMARY_ACTIVITY_RANGE = "7 days"
export const SIGNIFICANT_DECIMALS = 4

export default class PlaceModel extends Model<PlaceAttributes> {
  static tableName = "places"

  static async findByEntityIds(
    entityIds: string[]
  ): Promise<(PlaceAttributes & { entity_id: string })[]> {
    if (entityIds.length === 0) {
      return []
    }
    const sql = SQL`
      SELECT * FROM ${table(this)} p
      LEFT JOIN ${table(EntityPlaceModel)} ep ON "p"."id" = "ep"."place_id"
      WHERE "ep"."entity_id" IN ${values(entityIds)}
    `

    return this.namedQuery("find_by_entity_ids", sql)
  }

  static async findEnabledByPositions(
    positions: string[]
  ): Promise<PlaceAttributes[]> {
    if (positions.length === 0) {
      return []
    }

    const sql = SQL`
      SELECT * FROM ${table(this)}
      WHERE "disabled" = false
        AND "positions" && ${"{" + JSON.stringify(positions).slice(1, -1) + "}"}
    `

    return this.namedQuery("find_enabled_by_positions", sql)
  }

  static async findByIdWithAggregates(
    placeId: string,
    options: {
      user: string | undefined
    }
  ): Promise<AggregatePlaceAttributes> {
    const sql = SQL`
      SELECT p.*
      ${conditional(
        !!options.user,
        SQL`, uf."user" is not null as user_favorite`
      )}
      ${conditional(!options.user, SQL`, false as user_favorite`)}
      ${conditional(
        !!options.user,
        SQL`, coalesce(ul."like",false) as "user_like"`
      )}
      ${conditional(!options.user, SQL`, false as "user_like"`)}
      ${conditional(
        !!options.user,
        SQL`, not coalesce(ul."like",true) as "user_dislike"`
      )}
      ${conditional(!options.user, SQL`, false as "user_dislike"`)}
      FROM ${table(this)} p
      ${conditional(
        !!options.user,
        SQL`LEFT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.place_id AND uf."user" = ${options.user}`
      )}
      ${conditional(
        !!options.user,
        SQL`LEFT JOIN ${table(
          UserLikesModel
        )} ul on p.id = ul.place_id AND ul."user" = ${options.user}`
      )}
      WHERE "p"."id" = ${placeId}
    `

    const queryResult = await this.namedQuery("find_by_id_with_agregates", sql)
    return queryResult[0]
  }

  static async findWithAggregates(
    options: FindWithAggregatesOptions
  ): Promise<AggregatePlaceAttributes[]> {
    const orderBy =
      oneOf(options.order_by, [
        PlaceListOrderBy.HIGHEST_RATED,
        PlaceListOrderBy.UPDATED_AT,
      ]) ?? PlaceListOrderBy.UPDATED_AT
    const orderDirection = oneOf(options.order, ["asc", "desc"]) ?? "desc"

    const order = SQL.raw(`p.${orderBy} ${orderDirection.toUpperCase()}`)

    const sql = SQL`
      SELECT p.*
      ${conditional(
        !!options.user,
        SQL`, uf."user" is not null as user_favorite`
      )}
      ${conditional(!options.user, SQL`, false as user_favorite`)}
      ${conditional(
        !!options.user,
        SQL`, coalesce(ul."like",false) as "user_like"`
      )}
      ${conditional(!options.user, SQL`, false as "user_like"`)}
      ${conditional(
        !!options.user,
        SQL`, not coalesce(ul."like",true) as "user_dislike"`
      )}
      ${conditional(!options.user, SQL`, false as "user_dislike"`)}
      FROM ${table(this)} p
      ${conditional(
        !!options.user && !options.only_favorites,
        SQL`LEFT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.place_id AND uf."user" = ${options.user}`
      )}
      ${conditional(
        !!options.user && options.only_favorites,
        SQL`RIGHT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.place_id AND uf."user" = ${options.user}`
      )}
      ${conditional(
        !!options.user,
        SQL`LEFT JOIN ${table(
          UserLikesModel
        )} ul on p.id = ul.place_id AND ul."user" = ${options.user}`
      )}
      WHERE
        p.disabled is false
        ${conditional(
          options.positions?.length > 0,
          SQL.raw(
            `AND p.positions && ${
              "'{" + JSON.stringify(options.positions)?.slice(1, -1) + "}'"
            }`
          )
        )}
      ORDER BY ${order}
      ${limit(options.limit, { max: 100 })}
      ${offset(options.offset)}
    `

    const queryResult = await this.namedQuery("find_with_agregates", sql)
    return queryResult
  }

  static async countPlaces(
    options: Pick<
      FindWithAggregatesOptions,
      "user" | "only_favorites" | "positions"
    >
  ) {
    if (options.user && !isEthereumAddress(options.user)) {
      return 0
    }

    const query = SQL`
      SELECT
        count(*) as "total"
      FROM ${table(this)} p
      ${conditional(
        !!options.user && options.only_favorites,
        SQL`RIGHT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.place_id AND uf."user" = ${options.user}`
      )}
      WHERE
        p.disabled is false
        ${conditional(
          options.positions?.length > 0,
          SQL.raw(
            `AND p.positions && ${
              "'{" + JSON.stringify(options.positions)?.slice(1, -1) + "}'"
            }`
          )
        )}
    `
    const results: { total: number }[] = await this.namedQuery(
      "count_places",
      query
    )

    return results[0].total
  }

  static async disablePlaces(placesIds: string[]) {
    const now = new Date()
    return this.updateTo(
      { disabled: true, disabled_at: now },
      { id: placesIds }
    )
  }

  static async updateFavorites(placeId: string) {
    const sql = SQL`
    WITH counted AS (
      SELECT count(*) AS count
      FROM ${table(UserFavoriteModel)}
      WHERE "place_id" = ${placeId}
    )
    UPDATE ${table(this)}
      SET "favorites" = c.count
      FROM counted c
      WHERE "id" = ${placeId}
    `
    return this.namedQuery("update_favorites", sql)
  }

  static async updateLikes(placeId: string) {
    const sql = SQL`
    WITH counted AS (
      SELECT
        count(*) filter (where "like") as count_likes,
        count(*) filter (where not "like") as count_dislikes,
        count(*) filter (where "user_activity" >= ${MIN_USER_ACTIVITY}) as count_active_total,
        count(*) filter (where "like" and "user_activity" >= ${MIN_USER_ACTIVITY}) as count_active_likes
      FROM ${table(UserLikesModel)}
      WHERE "place_id" = ${placeId}
    )
    UPDATE ${table(this)}
      SET
        "likes" = c.count_likes,
        "dislikes" = c.count_dislikes,
        "like_rate" = (CASE WHEN c.count_active_total::float = 0 THEN 0
                            ELSE c.count_active_likes / c.count_active_total::float
                       END)
      FROM counted c
      WHERE "id" = ${placeId}
    `
    return this.namedQuery("update_likes", sql)
  }

  static async summaryActivities() {
    const sql = SQL`
      WITH range_activity AS (
        SELECT
          daily_activity."place_id",
          sum(daily_activity."activity") as "activity"
        FROM (
          SELECT
            "place_id",
            "date",
            (sum("users"::float) / sum("checks"::float) * ${
              10 ** SIGNIFICANT_DECIMALS
            })::bigint as activity
          FROM
            ${table(PlaceActivityDailyModel)}
          WHERE
            "date" >= (now() - ${SUMMARY_ACTIVITY_RANGE}::interval)
          GROUP BY "place_id", "date"
        ) daily_activity
        GROUP BY "place_id"
      )

      UPDATE ${table(this)}
      SET "activity_score" = range_activity.activity
      FROM range_activity
      WHERE "id" = range_activity.place_id
    `

    return this.namedRowCount("summary_activity", sql)
  }

  static async findWithHotScenes(
    options: FindWithAggregatesOptions,
    hotScenes: HotScene[]
  ): Promise<AggregatePlaceAttributes[]> {
    const { offset, limit, order, ...extraOptions } = options
    const places = await this.findWithAggregates({
      offset: 0,
      limit: 100,
      order,
      ...extraOptions,
    })

    const hotScenePlaces = hotScenes
      .filter(
        (scene) =>
          !!places.find(
            (place) => place.base_position == scene.baseCoords.join(",")
          )
      )
      .map((scene) => {
        const hotScenePlaces = places.find(
          (place) => place.base_position == scene.baseCoords.join(",")
        )
        return {
          ...hotScenePlaces!,
          user_count: scene.usersTotalCount,
        }
      })
    if (order === "asc") {
      hotScenePlaces.reverse()
    }

    const from = numeric(offset || 0, { min: 0 })
    const to = numeric(from + (limit || 100), { min: 0, max: 100 })

    return hotScenePlaces.slice(from, to)
  }
}
