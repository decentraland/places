import {
  SQL,
  SQLStatement,
  conditional,
  limit,
  offset,
  table,
  tsquery,
  values,
} from "decentraland-gatsby/dist/entities/Database/utils"
import { numeric, oneOf } from "decentraland-gatsby/dist/entities/Schema/utils"

import {
  AggregateDestinationAttributes,
  FindDestinationsWithAggregatesOptions,
} from "./types"
import PlaceModel from "../Place/model"
import { HotScene, PlaceListOrderBy } from "../Place/types"
import PlaceCategories from "../PlaceCategories/model"
import {
  buildUserInteractionColumns,
  buildUserInteractionJoins,
  buildWorldTextSearchRank,
} from "../shared/entityInteractions"
import WorldModel from "../World/model"

export default class DestinationModel {
  /**
   * Build the places sub-query selecting from the places table (world=false).
   * Returns AggregateDestinationAttributes-compatible columns.
   */
  private static buildPlacesSubQuery(
    options: FindDestinationsWithAggregatesOptions,
    opts?: { forCount?: boolean }
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
        ${conditional(
          !forCount,
          SQL`
        p.id, p.title, p.description, p.image, p.owner, p.world_name,
        p.content_rating, p.categories, p.likes, p.dislikes, p.favorites,
        p.like_rate, p.like_score, p.disabled, p.disabled_at,
        p.created_at, p.updated_at,
        p.base_position, p.contact_name, p.deployed_at,
        p.highlighted, false as world, false as is_private,
        p.highlighted_image, p.positions, p.contact_email,
        p.creator_address, p.sdk, p.ranking,
        0 as user_visits
        `
        )}
        ${conditional(forCount, SQL`p.id`)}
        ${buildUserInteractionColumns(options.user, forCount)}
        ${conditional(
          !forCount && filterMostActivePlaces,
          SQL`, (map.base_position IS NOT NULL)::int AS is_most_active_place`
        )}
        ${conditional(
          !forCount && !!options.search,
          SQL`, ts_rank_cd(p.textsearch, to_tsquery(${tsquery(
            options.search || ""
          )})) as rank`
        )}
      FROM ${table(PlaceModel)} p
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
      WHERE ${PlaceModel.buildWhereConditions("p", options, {
        worldFilter: "always",
      })}
    `
  }

  /**
   * Build the worlds sub-query selecting from the worlds table.
   * Returns AggregateDestinationAttributes-compatible columns via lateral join.
   */
  private static buildWorldsSubQuery(
    options: FindDestinationsWithAggregatesOptions,
    opts?: { forCount?: boolean }
  ): SQLStatement {
    const forCount = opts?.forCount ?? false
    return SQL`
      SELECT
        ${conditional(
          !forCount,
          SQL`
        w.id, w.title, w.description, COALESCE(w.image, lp.image) as image,
        w.owner, w.world_name,
        w.content_rating, w.categories, w.likes, w.dislikes, w.favorites,
        w.like_rate, w.like_score, w.disabled, w.disabled_at,
        w.created_at, w.updated_at,
        '0,0' as base_position, lp.contact_name, lp.deployed_at,
        w.highlighted, true as world, w.is_private,
        w.highlighted_image, '{}'::varchar[] as positions,
        lp.contact_email, lp.creator_address, lp.sdk, w.ranking,
        0 as user_visits
        `
        )}
        ${conditional(forCount, SQL`w.id`)}
        ${buildUserInteractionColumns(options.user, forCount)}
        ${conditional(
          !forCount && !!options.search,
          SQL`, ${buildWorldTextSearchRank("w", options.search || "")} as rank`
        )}
      FROM ${table(WorldModel)} w
      ${WorldModel.buildLatestPlaceLateralJoin("w")}
      ${buildUserInteractionJoins(SQL`w.id`, options.user, {
        onlyFavorites: options.only_favorites,
        forCount,
      })}
      ${WorldModel.buildWhereConditions("w", {
        categories: options.categories,
        search: options.search,
        only_highlighted: options.only_highlighted,
        world_names: options.world_names,
        names: options.names,
        owner: options.owner,
        ids: options.ids,
      })}
    `
  }

  /**
   * Find destinations with aggregates. Uses three strategies:
   * - only_places: query only places table (world=false)
   * - only_worlds: query only worlds table
   * - neither: UNION ALL of both
   */
  static async findWithAggregates(
    options: FindDestinationsWithAggregatesOptions
  ): Promise<AggregateDestinationAttributes[]> {
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

    const filterMostActivePlaces =
      options.order_by === PlaceListOrderBy.MOST_ACTIVE &&
      !!options.hotScenesPositions &&
      options.hotScenesPositions.length > 0

    if (options.only_places) {
      const placesQuery = this.buildPlacesSubQuery(options)
      const sql = SQL`
        ${placesQuery}
        ORDER BY
          p.highlighted DESC,
          p.ranking DESC NULLS LAST,
          ${conditional(
            filterMostActivePlaces,
            SQL`is_most_active_place DESC, `
          )}
          ${conditional(!!options.search, SQL`rank DESC, `)}
          ${SQL.raw(
            `p.${orderBy} ${orderDirection.toUpperCase()} NULLS LAST, p."deployed_at" DESC`
          )}
        ${limit(options.limit, { max: 100 })}
        ${offset(options.offset)}
      `
      return PlaceModel.namedQuery<AggregateDestinationAttributes>(
        "find_destinations_places",
        sql
      )
    }

    if (options.only_worlds) {
      const worldsQuery = this.buildWorldsSubQuery(options)
      const sql = SQL`
        ${worldsQuery}
        ORDER BY
          w.highlighted DESC,
          w.ranking DESC NULLS LAST,
          ${conditional(!!options.search, SQL`rank DESC, `)}
          ${SQL.raw(
            `w.${orderBy} ${orderDirection.toUpperCase()} NULLS LAST, w.updated_at DESC`
          )}
        ${limit(options.limit, { max: 100 })}
        ${offset(options.offset)}
      `
      return WorldModel.namedQuery<AggregateDestinationAttributes>(
        "find_destinations_worlds",
        sql
      )
    }

    // UNION ALL strategy
    const placesQuery = this.buildPlacesSubQuery(options)
    const worldsQuery = this.buildWorldsSubQuery(options)

    const sql = SQL`
      SELECT * FROM (
        (${placesQuery})
        UNION ALL
        (${worldsQuery})
      ) sub
      ORDER BY
        sub.highlighted DESC,
        sub.ranking DESC NULLS LAST,
        ${conditional(
          filterMostActivePlaces,
          SQL`sub.is_most_active_place DESC, `
        )}
        ${conditional(!!options.search, SQL`sub.rank DESC, `)}
        ${SQL.raw(
          `sub.${orderBy} ${orderDirection.toUpperCase()} NULLS LAST, sub.updated_at DESC`
        )}
      ${limit(options.limit, { max: 100 })}
      ${offset(options.offset)}
    `

    return PlaceModel.namedQuery<AggregateDestinationAttributes>(
      "find_destinations_union",
      sql
    )
  }

  /**
   * Count destinations. Uses three strategies matching findWithAggregates.
   */
  static async count(
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
  ): Promise<number> {
    const searchIsEmpty = options.search && options.search.length < 3
    if (searchIsEmpty) {
      return 0
    }

    // Build full options with defaults for sub-query builders
    const fullOptions: FindDestinationsWithAggregatesOptions = {
      ...options,
      offset: 0,
      limit: 0,
      order_by: "",
      order: "",
      positions: options.positions || [],
      world_names: options.world_names || [],
      names: options.names || [],
      only_favorites: options.only_favorites ?? false,
      only_highlighted: options.only_highlighted ?? false,
      only_worlds: options.only_worlds ?? false,
      only_places: options.only_places ?? false,
    }

    if (options.only_places) {
      const placesQuery = this.buildPlacesSubQuery(fullOptions, {
        forCount: true,
      })
      const sql = SQL`SELECT count(*) as total FROM (${placesQuery}) sub`
      const results: { total: string }[] = await PlaceModel.namedQuery(
        "count_destinations_places",
        sql
      )
      return Number(results[0].total)
    }

    if (options.only_worlds) {
      const worldsQuery = this.buildWorldsSubQuery(fullOptions, {
        forCount: true,
      })
      const sql = SQL`SELECT count(*) as total FROM (${worldsQuery}) sub`
      const results: { total: string }[] = await WorldModel.namedQuery(
        "count_destinations_worlds",
        sql
      )
      return Number(results[0].total)
    }

    // UNION ALL count
    const placesQuery = this.buildPlacesSubQuery(fullOptions, {
      forCount: true,
    })
    const worldsQuery = this.buildWorldsSubQuery(fullOptions, {
      forCount: true,
    })

    const sql = SQL`
      SELECT count(*) as total FROM (
        (${placesQuery})
        UNION ALL
        (${worldsQuery})
      ) sub
    `
    const results: { total: string }[] = await PlaceModel.namedQuery(
      "count_destinations_union",
      sql
    )
    return Number(results[0].total)
  }

  /**
   * Find destinations ordered by most active (hot scenes + world live data)
   */
  static async findWithHotScenes(
    options: FindDestinationsWithAggregatesOptions & {
      hotScenesPositions?: string[]
    },
    hotScenes: HotScene[]
  ): Promise<AggregateDestinationAttributes[]> {
    const {
      offset: offsetValue,
      limit: limitValue,
      order,
      ...extraOptions
    } = options
    const destinations = await this.findWithAggregates({
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

    // Include worlds if not filtering only_places
    const worldDestinations = options.only_places
      ? []
      : destinations.filter((d) => d.world)

    const allDestinations = [...hotSceneDestinations, ...worldDestinations]

    allDestinations.sort((a, b) => {
      if (a.highlighted !== b.highlighted) {
        return a.highlighted ? -1 : 1
      }
      const aRanking = a.ranking ?? -Infinity
      const bRanking = b.ranking ?? -Infinity
      if (aRanking !== bRanking) {
        return bRanking - aRanking
      }
      const aCount = a.user_count ?? 0
      const bCount = b.user_count ?? 0
      return order === "asc" ? aCount - bCount : bCount - aCount
    })

    const from = numeric(offsetValue || 0, { min: 0 }) ?? 0
    const to = numeric(from + (limitValue || 100), { min: 0, max: 100 }) ?? 100

    return allDestinations.slice(from, to)
  }
}
