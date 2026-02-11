import { Model } from "decentraland-gatsby/dist/entities/Database/model"
import {
  SQL,
  SQLStatement,
  columns,
  conditional,
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
import { diff, unique } from "radash"
import isEthereumAddress from "validator/lib/isEthereumAddress"

import {
  AggregatePlaceAttributes,
  FindWithAggregatesOptions,
  HotScene,
  PlaceAttributes,
  PlaceListOrderBy,
} from "./types"
import { FindDestinationsWithAggregatesOptions } from "../Destination/types"
import {
  type AggregateCoordinatePlaceAttributes,
  DEFAULT_MAX_LIMIT as DEFAULT_MAP_MAX_LIMIT,
  FindAllPlacesWithAggregatesOptions,
} from "../Map/types"
import PlaceCategories from "../PlaceCategories/model"
import PlacePositionModel from "../PlacePosition/model"
import {
  MIN_USER_ACTIVITY,
  buildTextsearch,
  buildUpdateFavoritesQuery,
  buildUpdateLikesQuery,
} from "../shared/entityInteractions"
import UserFavoriteModel from "../UserFavorite/model"
import UserLikesModel from "../UserLikes/model"

// Re-export for backwards compatibility
export { MIN_USER_ACTIVITY }
export const SUMMARY_ACTIVITY_RANGE = "7 days"
export const SIGNIFICANT_DECIMALS = 4

export default class PlaceModel extends Model<PlaceAttributes> {
  static tableName = "places"

  static textsearch(place: PlaceAttributes) {
    return buildTextsearch(place)
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

  /**
   * Find all places (scene entries) associated with a world by world_id
   */
  static async findByWorldId(worldId: string): Promise<PlaceAttributes[]> {
    const sql = SQL`
      SELECT * FROM ${table(this)}
      WHERE "world_id" = ${worldId}
    `

    return this.namedQuery("find_by_world_id", sql)
  }

  /**
   * Find a place by world_id and base_position (unique identifier for a scene in a world)
   */
  static async findByWorldIdAndBasePosition(
    worldId: string,
    basePosition: string
  ): Promise<PlaceAttributes | null> {
    const sql = SQL`
      SELECT * FROM ${table(this)}
      WHERE "world_id" = ${worldId}
        AND "base_position" = ${basePosition}
    `

    const results = await this.namedQuery<PlaceAttributes>(
      "find_by_world_id_and_base_position",
      sql
    )
    return results[0] || null
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
        )} uf on p.id = uf.entity_id AND uf."user" = ${options.user}`
      )}
      ${conditional(
        !!options.user,
        SQL`LEFT JOIN ${table(
          UserLikesModel
        )} ul on p.id = ul.entity_id AND ul."user" = ${options.user}`
      )}
      WHERE "p"."id" = ${placeId}
    `

    const queryResult = await this.namedQuery("find_by_id_with_agregates", sql)
    return queryResult[0]
  }

  static async findByIds(
    placeIds: string[]
  ): Promise<
    Pick<
      PlaceAttributes,
      "id" | "disabled" | "world" | "world_name" | "base_position"
    >[]
  > {
    const sql = SQL`
      SELECT p.id, p."disabled", p."world", p."world_name", p."base_position"
      FROM ${table(this)} p
      WHERE "p"."id" IN ${values(placeIds)}
    `

    const queryResult = await this.namedQuery("find_by_ids", sql)
    return queryResult
  }

  static async countByIds(placeIds: string[]) {
    const query = SQL`
      SELECT
        count(p.id) as "total"
      FROM ${table(this)} p
      WHERE "p"."id" IN ${values(placeIds)}
    `
    const results: { total: string }[] = await this.namedQuery(
      "count_by_ids",
      query
    )

    return Number(results[0].total)
  }

  static async findWithAggregates(
    options: FindWithAggregatesOptions
  ): Promise<AggregatePlaceAttributes[]> {
    const searchIsEmpty = options.search && options.search.length < 3
    if (searchIsEmpty) {
      return []
    }

    // The columns most_active, user_visits doesn't exists in the PlaceAttributes
    const orderBy =
      oneOf(options.order_by, [
        PlaceListOrderBy.LIKE_SCORE_BEST,
        PlaceListOrderBy.UPDATED_AT,
        PlaceListOrderBy.CREATED_AT,
      ]) ?? PlaceListOrderBy.LIKE_SCORE_BEST
    const orderDirection = oneOf(options.order, ["asc", "desc"]) ?? "desc"

    const order = SQL.raw(
      `p.${orderBy} ${orderDirection.toUpperCase()} NULLS LAST, p."deployed_at" DESC`
    )

    const filterMostActivePlaces =
      options.order_by === PlaceListOrderBy.MOST_ACTIVE &&
      !!options.hotScenesPositions &&
      options.hotScenesPositions.length > 0

    const sql = SQL`
      ${conditional(
        filterMostActivePlaces,
        SQL`WITH most_active_places AS (
              SELECT DISTINCT base_position
              FROM "place_positions"
              WHERE position IN ${values(options.hotScenesPositions || [])}
            )`
      )}
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
      ${conditional(
        filterMostActivePlaces,
        SQL`, (map.base_position IS NOT NULL)::int AS is_most_active_place`
      )}
      FROM ${table(this)} p

      ${conditional(
        !!options.user && !options.only_favorites,
        SQL`LEFT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.entity_id AND uf."user" = ${options.user}`
      )}
      ${conditional(
        !!options.user && options.only_favorites,
        SQL`RIGHT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.entity_id AND uf."user" = ${options.user}`
      )}
      ${conditional(
        !!options.user,
        SQL`LEFT JOIN ${table(
          UserLikesModel
        )} ul on p.id = ul.entity_id AND ul."user" = ${options.user}`
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
        filterMostActivePlaces,
        SQL`LEFT JOIN most_active_places "map" ON p.base_position = map.base_position`
      )}

      ${conditional(
        !!options.search,
        SQL`, ts_rank_cd(p.textsearch, to_tsquery(${tsquery(
          options.search || ""
        )})) as rank`
      )}

      WHERE
        p."disabled" is false 
        ${conditional(
          !options.only_highlighted && !options.ids && !options.names?.length,
          SQL`AND "world" is false`
        )}
        ${conditional(
          !!options.names?.length,
          SQL`AND p.world_id IN ${values(
            (options.names || []).map((n) => n.toLowerCase())
          )}`
        )}
        ${conditional(options.only_highlighted, SQL`AND highlighted = TRUE`)}
        ${conditional(!!options.search, SQL`AND rank > 0`)}
        ${conditional(
          options.positions?.length > 0 && !!options.names?.length,
          SQL`AND p.positions && ${options.positions}::varchar[]`
        )}
        ${conditional(
          options.positions?.length > 0 && !options.names?.length,
          SQL`AND p.base_position IN (
              SELECT DISTINCT(base_position)
              FROM ${table(PlacePositionModel)}
              WHERE position IN ${values(options.positions)}
            )`
        )}
        ${conditional(
          !!options.owner,
          SQL` AND (LOWER(p.owner) = ${options.owner} ${
            options.operatedPositions?.length
              ? SQL`OR p.base_position IN (
                  SELECT DISTINCT(base_position)
                  FROM ${table(PlacePositionModel)}
                  WHERE position IN ${values(options.operatedPositions)}
                )`
              : SQL``
          })`
        )}
        ${conditional(
          !!options.creator_address,
          SQL` AND LOWER(p.creator_address) = ${options.creator_address}`
        )}
        ${conditional(
          !!options.sdk,
          SQL` AND (p.sdk = ${options.sdk} OR p.sdk LIKE ${options.sdk + ".%"}${
            options.sdk === "6" ? SQL` OR p.sdk IS NULL` : SQL``
          })`
        )}
        ${conditional(
          !!options.ids,
          SQL` AND p.id IN ${values(options.ids || [])}`
        )}
      ORDER BY 
      ${conditional(filterMostActivePlaces, SQL`is_most_active_place DESC, `)}
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
      | "owner"
      | "operatedPositions"
      | "creator_address"
      | "sdk"
      | "names"
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
        )} uf on p.id = uf.entity_id AND uf."user" = ${options.user}`
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
        p."disabled" is false 
        ${conditional(
          !options.only_highlighted && !options.names?.length,
          SQL`AND "world" is false`
        )}
        ${conditional(
          !!options.names?.length,
          SQL`AND p.world_id IN ${values(
            (options.names || []).map((n) => n.toLowerCase())
          )}`
        )}
        ${conditional(options.only_highlighted, SQL`AND highlighted = TRUE`)}
        ${conditional(
          options.positions?.length > 0 && !!options.names?.length,
          SQL`AND p.positions && ${options.positions}::varchar[]`
        )}
        ${conditional(
          options.positions?.length > 0 && !options.names?.length,
          SQL`AND p.base_position IN (
              SELECT DISTINCT(base_position)
              FROM ${table(PlacePositionModel)}
              WHERE position IN ${values(options.positions)}
            )`
        )}
        ${conditional(!!options.search, SQL` AND rank > 0`)}
        ${conditional(
          !!options.owner,
          SQL` AND (LOWER(p.owner) = ${options.owner} ${
            options.operatedPositions?.length
              ? SQL`OR p.base_position IN (
                  SELECT DISTINCT(base_position)
                  FROM ${table(PlacePositionModel)}
                  WHERE position IN ${values(options.operatedPositions)}
                )`
              : SQL``
          })`
        )}
        ${conditional(
          !!options.creator_address,
          SQL` AND LOWER(p.creator_address) = ${options.creator_address}`
        )}
        ${conditional(
          !!options.sdk,
          SQL` AND (p.sdk = ${options.sdk} OR p.sdk LIKE ${options.sdk + ".%"}${
            options.sdk === "6" ? SQL` OR p.sdk IS NULL` : SQL``
          })`
        )}
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
    const sql = buildUpdateFavoritesQuery(this, placeId)
    return this.namedQuery("update_favorites", sql)
  }

  static async updateLikes(placeId: string) {
    const sql = buildUpdateLikesQuery(this, placeId)
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
      SQL` AND world is true AND "world_id" = ${place.world_id} AND "base_position" = ${place.base_position}`
    )}`

    return this.namedQuery("update_place", sql)
  }

  static overrideCategories(placeId: string, newCategories: string[]) {
    const categories =
      newCategories.length > 0
        ? join(newCategories.map((category) => SQL`${category}`))
        : SQL`ARRAY[]::text[]`

    const sql = SQL`UPDATE ${table(
      this
    )} SET categories = ARRAY [${categories}] WHERE id = ${placeId}`

    return this.namedQuery("override_categories", sql)
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

  static async findWithCoordinatesAggregates(
    options: FindWithAggregatesOptions
  ): Promise<AggregateCoordinatePlaceAttributes[]> {
    const searchIsEmpty = options.search && options.search.length < 3
    if (searchIsEmpty) {
      return []
    }

    // The columns most_active, user_visits doesn't exists in the PlaceAttributes
    const orderBy =
      oneOf(options.order_by, [
        PlaceListOrderBy.LIKE_SCORE_BEST,
        PlaceListOrderBy.UPDATED_AT,
        PlaceListOrderBy.CREATED_AT,
      ]) ?? PlaceListOrderBy.LIKE_SCORE_BEST
    const orderDirection = oneOf(options.order, ["asc", "desc"]) ?? "desc"

    const order = SQL.raw(
      `p.${orderBy} ${orderDirection.toUpperCase()} NULLS LAST, p.deployed_at DESC`
    )

    const sql = SQL`
      SELECT p.id, p.base_position, p.positions, p.title, p.description, p.image, p.contact_name, p.categories
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
        )} uf on p.id = uf.entity_id AND uf.user = ${options.user}`
      )}
      ${conditional(
        !!options.user && options.only_favorites,
        SQL`RIGHT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.entity_id AND uf.user = ${options.user}`
      )}
      ${conditional(
        !!options.user,
        SQL`LEFT JOIN ${table(
          UserLikesModel
        )} ul on p.id = ul.entity_id AND ul.user = ${options.user}`
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
        p.disabled is false 
        AND array_length(p.categories, 1) > 0
        ${conditional(!options.only_highlighted, SQL`AND world is false`)}
        ${conditional(options.only_highlighted, SQL`AND highlighted = TRUE`)}
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
      ${limit(options.limit, { max: DEFAULT_MAP_MAX_LIMIT })}
      ${offset(options.offset)}
    `

    const queryResult = await this.namedQuery<
      AggregateCoordinatePlaceAttributes & { category_id?: string }
    >("find_with_coordinates_aggregates", sql)
    return queryResult
  }

  static async countPlacesWithCoordinatesAggregates(
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
        )} uf on p.id = uf.entity_id AND uf."user" = ${options.user}`
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
        p.disabled is false 
        AND array_length(p.categories, 1) > 0
        ${conditional(!options.only_highlighted, SQL`AND "world" is false`)}
        ${conditional(options.only_highlighted, SQL`AND highlighted = TRUE`)}
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

  static async findAllPlacesWithAggregates(
    options: FindAllPlacesWithAggregatesOptions
  ): Promise<AggregatePlaceAttributes[]> {
    const searchIsEmpty = options.search && options.search.length < 3
    if (searchIsEmpty) {
      return []
    }

    // The columns most_active, user_visits doesn't exists in the PlaceAttributes
    const orderBy =
      oneOf(options.order_by, [
        PlaceListOrderBy.LIKE_SCORE_BEST,
        PlaceListOrderBy.UPDATED_AT,
        PlaceListOrderBy.CREATED_AT,
      ]) ?? PlaceListOrderBy.LIKE_SCORE_BEST

    const orderDirection = oneOf(options.order, ["asc", "desc"]) ?? "desc"
    const order = SQL.raw(
      `p.${orderBy} ${orderDirection.toUpperCase()} NULLS LAST, p.deployed_at DESC`
    )

    let placesOrWorldsCondition = SQL``
    if (options.positions.length > 0 && options.names.length > 0) {
      placesOrWorldsCondition = SQL`AND (
        p.base_position IN (
          SELECT DISTINCT(base_position)
          FROM ${table(PlacePositionModel)}
          WHERE position IN ${values(options.positions)}
        )
        OR
        p.world_name IN ${values(options.names)}
      )`
    } else if (options.positions.length > 0) {
      placesOrWorldsCondition = SQL`AND p.base_position IN (
        SELECT DISTINCT(base_position)
        FROM ${table(PlacePositionModel)}
        WHERE position IN ${values(options.positions)}
      )`
    } else if (options.names.length > 0) {
      placesOrWorldsCondition = SQL`AND p.world_name IN ${values(
        options.names
      )}`
    } else {
      placesOrWorldsCondition = SQL`AND p.world is false`
    }

    const sql = SQL`
      SELECT p.*
      ${conditional(
        !!options.user,
        SQL`, uf."user" is not null as user_favorite, coalesce(ul."like",false) as "user_like", not coalesce(ul."like",true) as "user_dislike"`
      )}
      ${conditional(
        !options.user,
        SQL`, false as user_favorite, false as "user_like", false as "user_dislike"`
      )}
      FROM ${table(this)} p
      ${conditional(
        !!options.user && !options.only_favorites,
        SQL`LEFT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.entity_id AND uf."user" = ${options.user}`
      )}
      ${conditional(
        !!options.user && options.only_favorites,
        SQL`RIGHT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.entity_id AND uf."user" = ${options.user}`
      )}
      ${conditional(
        !!options.user,
        SQL`LEFT JOIN ${table(
          UserLikesModel
        )} ul on p.id = ul.entity_id AND ul."user" = ${options.user}`
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
        p.disabled is false 
        ${conditional(options.only_highlighted, SQL`AND highlighted = TRUE`)}
        ${conditional(!!options.search, SQL`AND rank > 0`)}
        ${conditional(!!placesOrWorldsCondition, placesOrWorldsCondition)}
        ${conditional(
          !!options.creator_address,
          SQL` AND LOWER(p.creator_address) = ${options.creator_address}`
        )}
        ${conditional(
          !!options.sdk,
          SQL` AND (p.sdk = ${options.sdk} OR p.sdk LIKE ${options.sdk + ".%"}${
            options.sdk === "6" ? SQL` OR p.sdk IS NULL` : SQL``
          })`
        )}
      ORDER BY 
      ${conditional(!!options.search, SQL`rank DESC, `)}
      ${order}
      ${limit(options.limit, { max: DEFAULT_MAP_MAX_LIMIT })}
      ${offset(options.offset)}
    `

    const queryResult = await this.namedQuery<
      AggregatePlaceAttributes & { category_id?: string }
    >("find_with_agregates", sql)

    return queryResult
  }

  static async countAllPlaces(
    options: Pick<
      FindAllPlacesWithAggregatesOptions,
      | "user"
      | "only_favorites"
      | "positions"
      | "names"
      | "only_highlighted"
      | "search"
      | "categories"
      | "creator_address"
      | "sdk"
    >
  ) {
    const isMissingEthereumAddress =
      options.user && !isEthereumAddress(options.user)
    const searchIsEmpty = options.search && options.search.length < 3

    if (isMissingEthereumAddress || searchIsEmpty) {
      return 0
    }

    let placesOrWorldsCondition = SQL``
    if (options.positions.length > 0 && options.names.length > 0) {
      placesOrWorldsCondition = SQL`AND (
        p.base_position IN (
          SELECT DISTINCT(base_position)
          FROM ${table(PlacePositionModel)}
          WHERE position IN ${values(options.positions)}
        )
        OR
        p.world_name IN ${values(options.names)}
      )`
    } else if (options.positions.length > 0) {
      placesOrWorldsCondition = SQL`AND p.base_position IN (
        SELECT DISTINCT(base_position)
        FROM ${table(PlacePositionModel)}
        WHERE position IN ${values(options.positions)}
      )`
    } else if (options.names.length > 0) {
      placesOrWorldsCondition = SQL`AND p.world_name IN ${values(
        options.names
      )}`
    } else {
      placesOrWorldsCondition = SQL`AND p.world is false`
    }

    const query = SQL`
      SELECT
        count(DISTINCT p.id) as total
      FROM ${table(this)} p
      ${conditional(
        !!options.user && options.only_favorites,
        SQL`RIGHT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.entity_id AND uf.user = ${options.user}`
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
        p."disabled" is false 
        ${conditional(options.only_highlighted, SQL`AND highlighted = TRUE`)}
        ${conditional(!!options.search, SQL` AND rank > 0`)}
        ${conditional(!!placesOrWorldsCondition, placesOrWorldsCondition)}
        ${conditional(
          !!options.creator_address,
          SQL` AND LOWER(p.creator_address) = ${options.creator_address}`
        )}
        ${conditional(
          !!options.sdk,
          SQL` AND (p.sdk = ${options.sdk} OR p.sdk LIKE ${options.sdk + ".%"}${
            options.sdk === "6" ? SQL` OR p.sdk IS NULL` : SQL``
          })`
        )}
    `
    const results: { total: string }[] = await this.namedQuery(
      "count_places",
      query
    )

    return Number(results[0].total)
  }

  /**
   * Build SQL condition for filtering destinations by positions and/or world names
   */
  private static buildDestinationFilterCondition(options: {
    positions: string[]
    world_names: string[]
    names: string[]
    only_places: boolean
    only_worlds: boolean
  }): SQLStatement {
    const hasPositions = options.positions.length > 0
    const hasWorldNames = options.world_names.length > 0
    const hasNames = options.names.length > 0

    // Build world name conditions (exact match and/or LIKE)
    const buildWorldConditions = (): ReturnType<typeof SQL>[] => {
      const conditions: ReturnType<typeof SQL>[] = []
      if (hasWorldNames) {
        conditions.push(
          SQL`LOWER(p.world_name) = ANY(${options.world_names.map(
            (name: string) => name.toLowerCase()
          )})`
        )
      }
      if (hasNames) {
        const nameLikeConditions = options.names.map(
          (name: string) =>
            SQL`LOWER(p.world_name) LIKE ${`%${name.toLowerCase()}%`}`
        )
        conditions.push(SQL`(${join(nameLikeConditions, SQL` OR `)})`)
      }
      return conditions
    }

    if (
      hasPositions &&
      (hasWorldNames || hasNames) &&
      !options.only_places &&
      !options.only_worlds
    ) {
      const worldConditions = buildWorldConditions()
      return SQL`AND (
        (p.world is false AND p.base_position IN (
          SELECT DISTINCT(base_position)
          FROM ${table(PlacePositionModel)}
          WHERE position IN ${values(options.positions)}
        ))
        OR
        (p.world is true AND (${join(worldConditions, SQL` OR `)}))
      )`
    }

    if (hasPositions && !options.only_worlds) {
      return SQL`AND p.base_position IN (
        SELECT DISTINCT(base_position)
        FROM ${table(PlacePositionModel)}
        WHERE position IN ${values(options.positions)}
      )`
    }

    if ((hasWorldNames || hasNames) && !options.only_places) {
      const worldConditions = buildWorldConditions()
      return SQL`AND (${join(worldConditions, SQL` OR `)})`
    }

    return SQL``
  }

  /**
   * Find destinations (combined places and worlds) with aggregates
   * Supports filtering by positions, world_names (exact), names (LIKE), search, categories, owner, creator_address, sdk
   * and can filter by only_places or only_worlds.
   * Note: SDK filter treats null SDK values as SDK6 (legacy scenes). Use sdk='6' to include legacy scenes.
   */
  static async findDestinationsWithAggregates(
    options: FindDestinationsWithAggregatesOptions
  ): Promise<AggregatePlaceAttributes[]> {
    const searchIsEmpty = options.search && options.search.length < 3
    if (searchIsEmpty) {
      return []
    }

    const orderBy =
      oneOf(options.order_by, [
        PlaceListOrderBy.LIKE_SCORE_BEST,
        PlaceListOrderBy.UPDATED_AT,
        PlaceListOrderBy.CREATED_AT,
      ]) ?? PlaceListOrderBy.LIKE_SCORE_BEST

    const orderDirection = oneOf(options.order, ["asc", "desc"]) ?? "desc"
    const order = SQL.raw(
      `p.${orderBy} ${orderDirection.toUpperCase()} NULLS LAST, p."deployed_at" DESC`
    )

    const filterMostActivePlaces =
      options.order_by === PlaceListOrderBy.MOST_ACTIVE &&
      !!options.hotScenesPositions &&
      options.hotScenesPositions.length > 0

    const placesOrWorldsCondition =
      this.buildDestinationFilterCondition(options)

    const sql = SQL`
      ${conditional(
        filterMostActivePlaces,
        SQL`WITH most_active_places AS (
              SELECT DISTINCT base_position
              FROM "place_positions"
              WHERE position IN ${values(options.hotScenesPositions || [])}
            )`
      )}
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
      ${conditional(
        filterMostActivePlaces,
        SQL`, (map.base_position IS NOT NULL)::int AS is_most_active_place`
      )}
      FROM ${table(this)} p

      ${conditional(
        !!options.user && !options.only_favorites,
        SQL`LEFT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.entity_id AND uf."user" = ${options.user}`
      )}
      ${conditional(
        !!options.user && options.only_favorites,
        SQL`RIGHT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.entity_id AND uf."user" = ${options.user}`
      )}
      ${conditional(
        !!options.user,
        SQL`LEFT JOIN ${table(
          UserLikesModel
        )} ul on p.id = ul.entity_id AND ul."user" = ${options.user}`
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
        filterMostActivePlaces,
        SQL`LEFT JOIN most_active_places "map" ON p.base_position = map.base_position`
      )}

      ${conditional(
        !!options.search,
        SQL`, ts_rank_cd(p.textsearch, to_tsquery(${tsquery(
          options.search || ""
        )})) as rank`
      )}

      WHERE
        p."disabled" is false 
        ${conditional(options.only_highlighted, SQL`AND p.highlighted = TRUE`)}
        ${conditional(options.only_places, SQL`AND p.world is false`)}
        ${conditional(options.only_worlds, SQL`AND p.world is true`)}
        ${conditional(!!options.search, SQL`AND rank > 0`)}
        ${conditional(!!placesOrWorldsCondition, placesOrWorldsCondition)}
        ${conditional(
          !!options.owner,
          SQL` AND (LOWER(p.owner) = ${options.owner} ${
            options.operatedPositions?.length
              ? SQL`OR p.base_position IN (
                  SELECT DISTINCT(base_position)
                  FROM ${table(PlacePositionModel)}
                  WHERE position IN ${values(options.operatedPositions)}
                )`
              : SQL``
          })`
        )}
        ${conditional(
          !!options.creator_address,
          SQL` AND LOWER(p.creator_address) = ${options.creator_address}`
        )}
        ${conditional(
          !!options.sdk,
          SQL` AND (p.sdk = ${options.sdk} OR p.sdk LIKE ${options.sdk + ".%"}${
            options.sdk === "6" ? SQL` OR p.sdk IS NULL` : SQL``
          })`
        )}
        ${conditional(
          !!options.ids,
          SQL` AND p.id IN ${values(options.ids || [])}`
        )}
      ORDER BY 
      p.highlighted DESC,
      p.ranking DESC NULLS LAST,
      ${conditional(filterMostActivePlaces, SQL`is_most_active_place DESC, `)}
      ${conditional(!!options.search, SQL`rank DESC, `)}
      ${order}
      ${limit(options.limit, { max: 100 })}
      ${offset(options.offset)}
    `

    const queryResult = await this.namedQuery<
      AggregatePlaceAttributes & { category_id?: string }
    >("find_destinations_with_agregates", sql)
    return queryResult
  }

  /**
   * Count destinations (combined places and worlds) with the given filters
   */
  static async countDestinations(
    options: Pick<
      FindDestinationsWithAggregatesOptions,
      | "user"
      | "only_favorites"
      | "positions"
      | "world_names"
      | "names"
      | "only_highlighted"
      | "search"
      | "categories"
      | "owner"
      | "operatedPositions"
      | "creator_address"
      | "only_worlds"
      | "only_places"
      | "sdk"
      | "ids"
    >
  ) {
    const searchIsEmpty = options.search && options.search.length < 3

    if (searchIsEmpty) {
      return 0
    }

    const placesOrWorldsCondition =
      this.buildDestinationFilterCondition(options)

    const query = SQL`
      SELECT
        count(DISTINCT p.id) as "total"
      FROM ${table(this)} p
      ${conditional(
        !!options.user && options.only_favorites,
        SQL`RIGHT JOIN ${table(
          UserFavoriteModel
        )} uf on p.id = uf.entity_id AND uf."user" = ${options.user}`
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
        p."disabled" is false 
        ${conditional(options.only_highlighted, SQL`AND p.highlighted = TRUE`)}
        ${conditional(options.only_places, SQL`AND p.world is false`)}
        ${conditional(options.only_worlds, SQL`AND p.world is true`)}
        ${conditional(!!options.search, SQL` AND rank > 0`)}
        ${conditional(!!placesOrWorldsCondition, placesOrWorldsCondition)}
        ${conditional(
          !!options.owner,
          SQL` AND (LOWER(p.owner) = ${options.owner} ${
            options.operatedPositions?.length
              ? SQL`OR p.base_position IN (
                  SELECT DISTINCT(base_position)
                  FROM ${table(PlacePositionModel)}
                  WHERE position IN ${values(options.operatedPositions)}
                )`
              : SQL``
          })`
        )}
        ${conditional(
          !!options.creator_address,
          SQL` AND LOWER(p.creator_address) = ${options.creator_address}`
        )}
        ${conditional(
          !!options.sdk,
          SQL` AND (p.sdk = ${options.sdk} OR p.sdk LIKE ${options.sdk + ".%"}${
            options.sdk === "6" ? SQL` OR p.sdk IS NULL` : SQL``
          })`
        )}
        ${conditional(
          !!options.ids,
          SQL` AND p.id IN ${values(options.ids || [])}`
        )}
    `
    const results: { total: string }[] = await this.namedQuery(
      "count_destinations",
      query
    )

    return Number(results[0].total)
  }

  /**
   * Find destinations ordered by most active (hot scenes + world live data)
   */
  static async findDestinationsWithHotScenes(
    options: FindDestinationsWithAggregatesOptions & {
      hotScenesPositions?: string[]
    },
    hotScenes: HotScene[]
  ): Promise<AggregatePlaceAttributes[]> {
    const {
      offset: offsetValue,
      limit: limitValue,
      order,
      ...extraOptions
    } = options
    const destinations = await this.findDestinationsWithAggregates({
      offset: 0,
      limit: 100,
      order,
      ...extraOptions,
    })

    const hotSceneDestinations = hotScenes
      .filter(
        (scene) =>
          !!destinations.find(
            (destination) =>
              !destination.world &&
              destination.base_position === scene.baseCoords.join(",")
          )
      )
      .map((scene) => {
        const hotSceneDestination = destinations.find(
          (destination) =>
            destination.base_position === scene.baseCoords.join(",")
        )
        return {
          ...hotSceneDestination!,
          user_count: scene.usersTotalCount,
        }
      })

    // Also include worlds (which are not in hotScenes) if not filtering only_places
    const worldDestinations = options.only_places
      ? []
      : destinations.filter((d) => d.world)

    // Combine hot scene places and worlds
    const allDestinations = [...hotSceneDestinations, ...worldDestinations]

    // Sort highlighted items first, then by ranking, then by activity/order
    allDestinations.sort((a, b) => {
      // Highlighted items come first
      if (a.highlighted !== b.highlighted) {
        return a.highlighted ? -1 : 1
      }
      // Then sort by ranking (higher ranking first, nulls last)
      const aRanking = a.ranking ?? -Infinity
      const bRanking = b.ranking ?? -Infinity
      if (aRanking !== bRanking) {
        return bRanking - aRanking
      }
      // Then sort by user_count (activity) if available
      const aCount = a.user_count ?? 0
      const bCount = b.user_count ?? 0
      return order === "asc" ? aCount - bCount : bCount - aCount
    })

    const from = numeric(offsetValue || 0, { min: 0 }) ?? 0
    const to = numeric(from + (limitValue || 100), { min: 0, max: 100 }) ?? 100

    return allDestinations.slice(from, to)
  }
}
