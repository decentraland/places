import { Model } from "decentraland-gatsby/dist/entities/Database/model"
import {
  SQL,
  conditional,
  limit,
  offset,
  table,
  values,
} from "decentraland-gatsby/dist/entities/Database/utils"
import isEthereumAddress from "validator/lib/isEthereumAddress"

import EntityPlaceModel from "../EntityPlace/model"
import UserFavoriteModel from "../UserFavorite/model"
import UserLikesModel from "../UserLikes/model"
import {
  AggregatePlaceAttributes,
  FindWithAggregatesOptions,
  PlaceAttributes,
  PlaceListOrderBy,
} from "./types"

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

    return this.namedQuery(this.tableName + "_find_by_entity_ids", sql)
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

    return this.namedQuery(this.tableName + "_find_enabled_by_positions", sql)
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

    const queryResult = await this.namedQuery(
      this.tableName + "_find_by_id_with_agregates",
      sql
    )
    return queryResult[0]
  }

  static async findWithAggregates(
    options: FindWithAggregatesOptions
  ): Promise<AggregatePlaceAttributes[]> {
    const orderBy = "p.updated_at"
    const orderDirection = options.order === "asc" ? "ASC" : "DESC"

    let order = SQL`${SQL.raw(orderBy)} ${SQL.raw(orderDirection)}`

    if (options.orderBy === PlaceListOrderBy.POPULARITY) {
      order = SQL`p.likes ${SQL.raw(orderDirection)}`
    }

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
        !!options.user && !options.onlyFavorites,
        SQL`LEFT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.place_id AND uf."user" = ${options.user}`
      )}
      ${conditional(
        !!options.user && options.onlyFavorites,
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

    const queryResult = await this.namedQuery(
      this.tableName + "_find_with_agregates",
      sql
    )
    return queryResult
  }

  static async countPlaces(
    options: Pick<
      FindWithAggregatesOptions,
      "user" | "onlyFavorites" | "positions"
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
        !!options.user && options.onlyFavorites,
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
      this.tableName + "_count_places",
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
    return this.namedQuery(this.tableName + "_update_favorites", sql)
  }

  static async updateLikes(placeId: string) {
    const sql = SQL`
    WITH counted AS (
      SELECT count(*) filter (where "like") as count_likes,
       count(*) filter (where not "like") as count_dislikes
      FROM ${table(UserLikesModel)}
      WHERE "place_id" = ${placeId}
    ) 
    UPDATE ${table(this)}
      SET "likes" = c.count_likes, "dislikes" = c.count_dislikes
      FROM counted c
      WHERE "id" = ${placeId}
    `
    return this.namedQuery(this.tableName + "_update_likes", sql)
  }
}
