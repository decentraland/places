import { Model } from "decentraland-gatsby/dist/entities/Database/model"
import {
  SQL,
  SQLStatement,
  columns,
  conditional,
  createSearchableMatches,
  join,
  limit,
  objectValues,
  offset,
  setColumns,
  table,
  tsquery,
  values,
} from "decentraland-gatsby/dist/entities/Database/utils"
import { numeric, oneOf } from "decentraland-gatsby/dist/entities/Schema/utils"
import { diff, unique } from "radash/dist/array"
import isEthereumAddress from "validator/lib/isEthereumAddress"

import PlaceCategories from "../PlaceCategories/model"
import PlacePositionModel from "../PlacePosition/model"
import UserFavoriteModel from "../UserFavorite/model"
import UserLikesModel from "../UserLikes/model"
import {
  FindWorldWithAggregatesOptions,
  WorldListOrderBy,
} from "../World/types"
import {
  AggregatePlaceAttributes,
  FindWithAggregatesOptions,
  HotScene,
  PlaceAttributes,
  PlaceListOrderBy,
} from "./types"

export const MIN_USER_ACTIVITY = 100
export const SUMMARY_ACTIVITY_RANGE = "7 days"
export const SIGNIFICANT_DECIMALS = 4

export default class PlaceModel extends Model<PlaceAttributes> {
  static tableName = "places"

  static textsearch(place: PlaceAttributes) {
    return SQL`(${join(
      [
        SQL`setweight(to_tsvector(coalesce(${place.title}, '')), 'A')`,
        SQL`setweight(to_tsvector(coalesce(${place.world_name}, '')), 'A')`,
        SQL`setweight(to_tsvector(coalesce(${place.description}, '')), 'B')`,
        SQL`setweight(to_tsvector(${createSearchableMatches(
          place.description || ""
        )}), 'B')`,
        SQL`setweight(to_tsvector(coalesce(${place.owner}, '')), 'C')`,
      ],
      SQL` || `
    )})`
  }

  static async findEnabledByPositions(
    positions: string[]
  ): Promise<PlaceAttributes[]> {
    if (positions.length === 0) {
      return []
    }

    const sql = SQL`
      SELECT * FROM ${table(this)}
      WHERE "disabled" is false
        AND "world" is false
        AND "base_position" IN (
          SELECT DISTINCT("base_position")
          FROM ${table(PlacePositionModel)} "pp"
          WHERE "pp"."position" IN ${values(positions)}
        )
    `

    return this.namedQuery("find_enabled_by_positions", sql)
  }

  static async findEnabledWorldName(
    world_name: string
  ): Promise<PlaceAttributes[]> {
    const sql = SQL`
      SELECT * FROM ${table(this)}
      WHERE
        "disabled" is false
        AND "world" is true
        AND "world_name" = ${world_name}
    `

    return this.namedQuery("find_enabled_by_world_name", sql)
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
    const searchIsEmpty = options.search && options.search.length < 3
    if (searchIsEmpty) {
      return []
    }

    const orderBy = PlaceListOrderBy.LIKE_SCORE_BEST
    const orderDirection = oneOf(options.order, ["asc", "desc"]) ?? "desc"

    const order = SQL.raw(
      `p.${orderBy} ${orderDirection.toUpperCase()} NULLS LAST, p."deployed_at" DESC`
    )

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
      ${conditional(
        !!options.categories.length,
        SQL`INNER JOIN ${table(
          PlaceCategories
        )} pc ON p.id = pc.place_id AND pc.category_id IN ${values(
          options.categories
        )}`
      )}

      ${conditional(
        !!options.search,
        SQL`, ts_rank_cd(p.textsearch, to_tsquery(${tsquery(
          options.search || ""
        )})) as rank`
      )}

      WHERE
        p."disabled" is false AND "world" is false
        ${conditional(!!options.search, SQL`AND rank > 0`)}
        ${conditional(
          options.positions?.length > 0,
          SQL`AND p.base_position IN (
              SELECT DISTINCT(base_position)
              FROM ${table(PlacePositionModel)}
              WHERE position IN ${values(options.positions)}
            )`
        )}
      ORDER BY 
      ${conditional(!!options.search, SQL`rank DESC, `)}
      ${order}
      ${limit(options.limit, { max: 100 })}
      ${offset(options.offset)}
    `

    const queryResult = await this.namedQuery<
      AggregatePlaceAttributes & { category_id?: string }
    >("find_with_agregates", sql)
    return queryResult
  }

  static async countPlaces(
    options: Pick<
      FindWithAggregatesOptions,
      | "user"
      | "only_favorites"
      | "positions"
      | "only_highlighted"
      | "search"
      | "categories"
    >
  ) {
    const isMissingEthereumAddress =
      options.user && !isEthereumAddress(options.user)
    const searchIsEmpty = options.search && options.search.length < 3

    if (isMissingEthereumAddress || searchIsEmpty) {
      return 0
    }

    const query = SQL`
      SELECT
        count(DISTINCT p.id) as "total"
      FROM ${table(this)} p
      ${conditional(
        !!options.user && options.only_favorites,
        SQL`RIGHT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.place_id AND uf."user" = ${options.user}`
      )}
      ${conditional(
        !!options.categories.length,
        SQL`INNER JOIN ${table(
          PlaceCategories
        )} pc ON p.id = pc.place_id AND pc.category_id IN ${values(
          options.categories
        )}`
      )}

      ${conditional(
        !!options.search,
        SQL`, ts_rank_cd(p.textsearch, to_tsquery(${tsquery(
          options.search || ""
        )})) as rank`
      )}

      WHERE
        p."disabled" is false AND "world" is false
        ${conditional(
          options.positions?.length > 0,
          SQL`AND p.base_position IN (
              SELECT DISTINCT(base_position)
              FROM ${table(PlacePositionModel)}
              WHERE position IN ${values(options.positions)}
            )`
        )}
        ${conditional(!!options.search, SQL` AND rank > 0`)}
    `
    const results: { total: string }[] = await this.namedQuery(
      "count_places",
      query
    )

    return Number(results[0].total)
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
        count(*) filter (where "like" and "user_activity" >= ${MIN_USER_ACTIVITY}) as count_active_likes,
        count(*) filter (where not "like" and "user_activity" >= ${MIN_USER_ACTIVITY}) as count_active_dislikes
      FROM ${table(UserLikesModel)}
      WHERE "place_id" = ${placeId}
    )
    UPDATE ${table(this)}
      SET
        "likes" = c.count_likes,
        "dislikes" = c.count_dislikes,
        "like_rate" = (CASE WHEN c.count_active_total::float = 0 THEN NULL
                            ELSE c.count_active_likes / c.count_active_total::float
                       END),
        "like_score" = (${PlaceModel.calculateLikeScoreStatement()})
      FROM counted c
      WHERE "id" = ${placeId}
    `
    return this.namedQuery("update_likes", sql)
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

    const from = numeric(offset || 0, { min: 0 }) ?? 0
    const to = numeric(from + (limit || 100), { min: 0, max: 100 }) ?? 100

    return hotScenePlaces.slice(from, to)
  }

  static async insertPlace(
    place: Partial<PlaceAttributes>,
    attributes: Array<keyof PlaceAttributes>
  ) {
    const keys = unique([...attributes, "id"])
    const sql = SQL`INSERT INTO ${table(this)} ${columns(keys)}
              VALUES ${objectValues(keys, [place])}`
    return this.namedQuery("insert_place", sql)
  }

  static updatePlace = (
    place: Partial<PlaceAttributes>,
    attributes: Array<keyof PlaceAttributes>
  ) => {
    const keys = unique(diff(attributes, ["id", "created_at"])) as Array<
      keyof PlaceAttributes
    >
    const sql = SQL`UPDATE ${table(this)} SET ${setColumns(
      keys,
      place
    )} WHERE disabled is false
    ${conditional(
      !place.world,
      SQL`AND world is false AND "base_position" IN (
        SELECT DISTINCT("base_position")
        FROM ${table(PlacePositionModel)} "pp"
        WHERE "pp"."position" = ${place.base_position}
      )`
    )}
    ${conditional(
      !!place.world,
      SQL` AND world is true AND ${place.world_name} = "world_name"`
    )}`

    return this.namedQuery("update_place", sql)
  }

  static overrideCategories(placeId: string, newCategories: string[]) {
    const categories = newCategories
      .map((category) => `'${category}'`)
      .join(",")

    const sql = SQL`UPDATE ${table(
      this
    )} SET categories = ARRAY [${categories}] WHERE id = ${placeId}`

    return this.namedQuery("override_categories", sql)
  }

  static async findWorlds(): Promise<PlaceAttributes[]> {
    const sql = SQL`
      SELECT * FROM ${table(this)}
      WHERE "world" is true and disabled is false
      ORDER BY updated_at ASC LIMIT 500
    `

    return this.namedQuery("find_worlds", sql)
  }

  static async findWorld(
    options: FindWorldWithAggregatesOptions
  ): Promise<AggregatePlaceAttributes[]> {
    const searchIsEmpty = options.search && options.search.length < 3

    if (searchIsEmpty) {
      return []
    }

    const orderBy = WorldListOrderBy.LIKE_SCORE_BEST
    const orderDirection = oneOf(options.order, ["asc", "desc"]) ?? "desc"

    const order = SQL.raw(
      `p.${orderBy} ${orderDirection.toUpperCase()} NULLS LAST, p."deployed_at" DESC`
    )

    const sql = SQL`
      SELECT p.*
      ${conditional(
        !!options.user,
        SQL`, uf.user is not null as user_favorite`
      )}
      ${conditional(!options.user, SQL`, false as user_favorite`)}
      ${conditional(
        !!options.user,
        SQL`, coalesce(ul.like,false) as user_like`
      )}
      ${conditional(!options.user, SQL`, false as user_like`)}
      ${conditional(
        !!options.user,
        SQL`, not coalesce(ul.like,true) as user_dislike`
      )}
      ${conditional(!options.user, SQL`, false as user_dislike`)}
      FROM ${table(this)} p
      ${conditional(
        !!options.user && !options.only_favorites,
        SQL`LEFT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.place_id AND uf.user = ${options.user}`
      )}
      ${conditional(
        !!options.user && options.only_favorites,
        SQL`RIGHT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.place_id AND uf.user = ${options.user}`
      )}
      ${conditional(
        !!options.user,
        SQL`LEFT JOIN ${table(
          UserLikesModel
        )} ul on p.id = ul.place_id AND ul.user = ${options.user}`
      )}
      ${conditional(
        !!options.search,
        SQL`, ts_rank_cd(p.textsearch, to_tsquery(${tsquery(
          options.search || ""
        )})) as rank`
      )}
      WHERE
        p.disabled is false AND world is true
        ${conditional(
          options.names.length > 0,
          SQL`AND world_name IN ${values(options.names)}`
        )}
        ${conditional(!!options.search, SQL` AND rank > 0`)}
      ORDER BY
      ${conditional(!!options.search, SQL`rank DESC, `)}
      ${order}
      ${limit(options.limit, { max: 100 })}
      ${offset(options.offset)}
    `

    return await this.namedQuery("find_worlds", sql)
  }

  static async countWorlds(
    options: Pick<
      FindWorldWithAggregatesOptions,
      "user" | "only_favorites" | "names" | "search"
    >
  ) {
    const isMissingEthereumAddress =
      options.user && !isEthereumAddress(options.user)
    const searchIsEmpty = options.search && options.search.length < 3
    if (isMissingEthereumAddress || searchIsEmpty) {
      return 0
    }

    const query = SQL`
      SELECT
        count(*) as total
      FROM ${table(this)} p
      ${conditional(
        !!options.user && options.only_favorites,
        SQL`RIGHT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.place_id AND uf.user = ${options.user}`
      )}
      ${conditional(
        !!options.search,
        SQL`, ts_rank_cd(p.textsearch, to_tsquery(${tsquery(
          options.search || ""
        )})) as rank`
      )}
      WHERE
        p.disabled is false
        AND p.world is true
        ${conditional(
          options.names.length > 0,
          SQL`AND p.world_name IN ${values(options.names)}`
        )}
        ${conditional(!!options.search, SQL` AND rank > 0`)}
    `
    const results: { total: number }[] = await this.namedQuery(
      "count_worlds",
      query
    )

    return Number(results[0].total)
  }

  static async findWorldNames(): Promise<{ world_name: string }[]> {
    const sql = SQL`
      SELECT p.world_name
      FROM ${table(this)} p
      WHERE
        p.disabled is false AND world is true
      ORDER BY p.world_name ASC
    `

    return await this.namedQuery("find_world_names", sql)
  }

  static async countWorldNames() {
    const query = SQL`
      SELECT
        count(*) as total
      FROM ${table(this)} p
      WHERE
        p.disabled is false
        AND p.world is true
    `
    const results: { total: number }[] = await this.namedQuery(
      "count_world_names",
      query
    )

    return Number(results[0].total)
  }

  static async findEnabledByCategory(
    category: string
  ): Promise<AggregatePlaceAttributes[]> {
    const sql = SQL`
      SELECT p.*
      FROM ${table(this)} p
      ${SQL`INNER JOIN ${table(
        PlaceCategories
      )} pc ON p.id = pc.place_id AND pc.category_id = ${SQL`${category}`}`}
      WHERE
        p."disabled" is false AND "world" is false
    `
    return await this.namedQuery("find_enabled_by_category", sql)
  }

  /**
   * For reference: https://www.evanmiller.org/how-not-to-sort-by-average-rating.html
   * We're calculating the lower bound of a 95% confidence interval
   */
  static calculateLikeScoreStatement(): SQLStatement {
    return SQL`CASE WHEN (c.count_active_likes + c.count_active_dislikes > 0) THEN ((c.count_active_likes + 1.9208)
    / (c.count_active_likes + c.count_active_dislikes) - 1.96
    * SQRT((c.count_active_likes * c.count_active_dislikes) / (c.count_active_likes + c.count_active_dislikes) + 0.9604)
    / (c.count_active_likes + c.count_active_dislikes))
    / (1 + 3.8416 / (c.count_active_likes + c.count_active_dislikes)) ELSE NULL END`
  }
}
