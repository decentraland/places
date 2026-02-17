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
  buildUserInteractionColumns,
  buildUserInteractionJoins,
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

  /**
   * Build shared WHERE clause fragments for place queries.
   * Used by findWithAggregates, countPlaces, and DestinationModel.buildPlacesSubQuery.
   *
   * @param alias - Table alias (e.g., "p")
   * @param options - Filter options
   * @param opts.worldFilter - Controls the "world is false" condition:
   *   - "always": always include `AND world is false` (for destination queries)
   *   - "conditional": include only when not highlighted/ids/names (for place-only queries)
   */
  static buildWhereConditions(
    alias: string,
    options: {
      search?: string
      positions?: string[]
      only_highlighted?: boolean
      owner?: string
      operatedPositions?: string[]
      creator_address?: string
      sdk?: string
      ids?: string[]
      names?: string[]
    },
    opts?: { worldFilter?: "always" | "conditional" }
  ): SQLStatement {
    const a = SQL.raw(alias)
    const worldFilter = opts?.worldFilter ?? "conditional"
    return SQL`
        ${a}."disabled" is false
        ${conditional(worldFilter === "always", SQL`AND ${a}.world is false`)}
        ${conditional(
          worldFilter === "conditional" &&
            !options.only_highlighted &&
            !options.ids?.length &&
            !options.names?.length,
          SQL`AND "world" is false`
        )}
        ${conditional(
          !!options.names?.length,
          SQL`AND ${a}.world_id IN ${values(
            (options.names || []).map((n) => n.toLowerCase())
          )}`
        )}
        ${conditional(
          options.only_highlighted ?? false,
          SQL`AND highlighted = TRUE`
        )}
        ${conditional(!!options.search, SQL`AND rank > 0`)}
        ${conditional(
          (options.positions?.length ?? 0) > 0 && !!options.names?.length,
          SQL`AND ${a}.positions && ${options.positions || []}::varchar[]`
        )}
        ${conditional(
          (options.positions?.length ?? 0) > 0 && !options.names?.length,
          SQL`AND ${a}.base_position IN (
              SELECT DISTINCT(base_position)
              FROM ${table(PlacePositionModel)}
              WHERE position IN ${values(
                options.positions?.length ? options.positions : [""]
              )}
            )`
        )}
        ${conditional(
          !!options.owner,
          SQL` AND (LOWER(${a}.owner) = ${options.owner} ${
            options.operatedPositions?.length
              ? SQL`OR ${a}.base_position IN (
                  SELECT DISTINCT(base_position)
                  FROM ${table(PlacePositionModel)}
                  WHERE position IN ${values(options.operatedPositions)}
                )`
              : SQL``
          })`
        )}
        ${conditional(
          !!options.creator_address,
          SQL` AND LOWER(${a}.creator_address) = ${options.creator_address}`
        )}
        ${conditional(
          !!options.sdk,
          SQL` AND (${a}.sdk = ${options.sdk} OR ${a}.sdk IS NULL)`
        )}
        ${conditional(
          !!options.ids?.length,
          SQL` AND ${a}.id IN ${values(options.ids || [])}`
        )}
    `
  }

  /**
   * Build a places sub-query (CTE + SELECT + FROM + JOINs + rank + WHERE).
   * Does NOT include ORDER BY/LIMIT/OFFSET -- callers append those.
   *
   * Used by findWithAggregates, countPlaces, and DestinationModel.
   *
   * @param options - Filter and search options
   * @param opts.forCount - When true: SELECT p.id only, skip CTE/most_active/interaction columns
   * @param opts.worldFilter - Controls the "world is false" condition in WHERE
   * @param opts.selectColumns - Custom SELECT columns (default: p.*)
   */
  static buildSubQuery(
    options: {
      user?: string
      only_favorites: boolean
      search?: string
      positions?: string[]
      only_highlighted?: boolean
      owner?: string
      operatedPositions?: string[]
      creator_address?: string
      sdk?: string
      ids?: string[]
      names?: string[]
      categories: string[]
      order_by?: string
      hotScenesPositions?: string[]
    },
    opts?: {
      forCount?: boolean
      worldFilter?: "always" | "conditional"
      selectColumns?: SQLStatement
    }
  ): SQLStatement {
    const forCount = opts?.forCount ?? false
    const filterMostActivePlaces =
      !forCount &&
      options.order_by === PlaceListOrderBy.MOST_ACTIVE &&
      !!options.hotScenesPositions &&
      options.hotScenesPositions.length > 0

    return SQL`
      ${conditional(
        filterMostActivePlaces,
        SQL`WITH most_active_places AS (
              SELECT DISTINCT base_position
              FROM "place_positions"
              WHERE position IN ${values(options.hotScenesPositions || [])}
            )`
      )}
      SELECT
        ${conditional(!forCount, opts?.selectColumns ?? SQL`p.*`)}
        ${conditional(forCount, SQL`p.id`)}
        ${buildUserInteractionColumns(options.user, forCount)}
        ${conditional(
          !forCount && filterMostActivePlaces,
          SQL`, (map.base_position IS NOT NULL)::int AS is_most_active_place`
        )}
        ${conditional(!forCount && !!options.search, SQL`, rank`)}
      FROM ${table(this)} p
      ${buildUserInteractionJoins(SQL`p.id`, options.user, {
        onlyFavorites: options.only_favorites,
        forCount,
      })}
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
      WHERE ${this.buildWhereConditions("p", options, {
        worldFilter: opts?.worldFilter ?? "conditional",
      })}
    `
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

    const subQuery = this.buildSubQuery(options)

    const sql = SQL`
      ${subQuery}
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

    const subQuery = this.buildSubQuery(options, { forCount: true })

    const query = SQL`
      SELECT count(DISTINCT sub.id) as "total"
      FROM (${subQuery}) sub
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

  /**
   * Delete all place records associated with a world that were deployed
   * before the given event timestamp. This prevents stale undeployment
   * events from removing places that were re-deployed after the event
   * was emitted.
   */
  static async deleteByWorldId(
    worldId: string,
    eventTimestamp: number
  ): Promise<void> {
    const normalizedWorldId = worldId.toLowerCase()
    const eventDate = new Date(eventTimestamp)
    const sql = SQL`
      DELETE FROM ${table(this)}
      WHERE "world_id" = ${normalizedWorldId}
        AND "deployed_at" < ${eventDate}
    `
    await this.namedQuery("delete_by_world_id", sql)
  }

  /**
   * Delete place records matching a world and specific base positions
   * that were deployed before the given event timestamp. This prevents
   * stale undeployment events from removing places that were re-deployed
   * after the event was emitted.
   */
  static async deleteByWorldIdAndPositions(
    worldId: string,
    basePositions: string[],
    eventTimestamp: number
  ): Promise<void> {
    const normalizedWorldId = worldId.toLowerCase()
    const eventDate = new Date(eventTimestamp)
    const sql = SQL`
      DELETE FROM ${table(this)}
      WHERE "world_id" = ${normalizedWorldId}
        AND "base_position" = ANY(${basePositions})
        AND "deployed_at" < ${eventDate}
    `
    await this.namedQuery("delete_by_world_id_and_positions", sql)
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
          SQL` AND (p.sdk = ${options.sdk} OR p.sdk IS NULL)`
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
          SQL` AND (p.sdk = ${options.sdk} OR p.sdk IS NULL)`
        )}
    `
    const results: { total: string }[] = await this.namedQuery(
      "count_places",
      query
    )

    return Number(results[0].total)
  }
}
