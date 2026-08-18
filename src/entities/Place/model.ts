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

/** Replace apostrophes with spaces so pg-tsquery doesn't merge them into the word
 *  (e.g. "Franky's" → "Franky s" instead of "Frankys") */
function sanitizeSearch(search: string): string {
  return search.replace(/'/g, " ")
}

/**
 * Restrict the inferred matches of an undeployment to the rows its survivor snapshot could describe.
 *
 * The survivor set is read from the content server before the per-world lock is held, so a
 * deployment for the same world can commit in between -- most plausibly the very one holding the
 * lock being waited on. Deciding by footprint or base parcel then infers from a survivor set that
 * predates the row, so those rows are left for an event whose survivor set includes them. An event
 * that names a deployment id needs no survivor set to justify itself and is deliberately not
 * restricted, which is what keeps an undeployment authoritative over a deployment it raced.
 * Matching the deployment id as well as the row id catches a revision replaced in situ.
 */
function withinSnapshot(
  snapshot: Array<{ id: string; deployment_id: string | null }>
): SQLStatement {
  // places.id is character(36), not uuid, so the ids bind as text
  return SQL`EXISTS (
    SELECT 1
    FROM unnest(
      ${snapshot.map((place) => place.id)}::text[],
      ${snapshot.map((place) => place.deployment_id)}::text[]
    ) AS snapshot("id", "deployment_id")
    WHERE snapshot."id" = target."id"
      AND snapshot."deployment_id" IS NOT DISTINCT FROM target."deployment_id"
  )`
}

/**
 * Match only the places the content server no longer serves, so an undeployment cannot disable a
 * scene that survived it.
 *
 * A deployment id identifies a surviving scene exactly, so a row that carries one is judged only by
 * that. Legacy rows predate deployment ids and can only be recognised by their footprint, so they
 * are spared where a surviving scene covers their parcels. Both arrays are empty for a world that
 * serves nothing, which matches every row.
 */
function removedUpstream(
  liveDeploymentIds: string[],
  livePositions: string[]
): SQLStatement {
  return SQL`(
    CASE WHEN target."deployment_id" IS NOT NULL
      THEN NOT (target."deployment_id" = ANY(${liveDeploymentIds}))
      ELSE NOT (target."positions" && ${livePositions}::varchar[])
    END
  )`
}

import {
  AggregatePlaceAttributes,
  DisabledReason,
  FindWithAggregatesOptions,
  HotScene,
  PlaceAttributes,
  PlaceListOrderBy,
} from "./types"
import { Model } from "../Database/model"
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
          SQL` AND (${a}.sdk = ${options.sdk} OR ${a}.sdk LIKE ${
            options.sdk + ".%"
          }${options.sdk === "6" ? SQL` OR ${a}.sdk IS NULL` : SQL``})`
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
          sanitizeSearch(options.search || "")
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

  static async findActiveByWorldIdAndPositions(
    worldId: string,
    positions: string[]
  ): Promise<PlaceAttributes[]> {
    if (positions.length === 0) {
      return []
    }

    const sql = SQL`
      SELECT * FROM ${table(this)}
      WHERE ("disabled" is false OR "disabled_reason" = 'opt_out')
        AND "world" is true
        AND "world_id" = ${worldId}
        AND "positions" && ${positions}
    `

    return this.namedQuery("find_active_by_world_id_and_positions", sql)
  }

  /**
   * Identify the enabled world places as they stand right now.
   *
   * A survivor set read from the content server can only speak about rows that existed when it was
   * read. Pairing each row with its deployment id captures both ways the set can go stale while the
   * per-world lock is being waited on: a place created, and a place whose revision was replaced in
   * situ. Unrelated writes such as likes or favourites leave both values untouched.
   */
  static async findEnabledWorldPlaceRevisions(
    worldId: string
  ): Promise<Array<{ id: string; deployment_id: string | null }>> {
    return this.namedQuery<{ id: string; deployment_id: string | null }>(
      "find_enabled_world_place_revisions",
      SQL`
        SELECT "id", "deployment_id"
        FROM ${table(this)}
        WHERE "world" IS TRUE
          AND "world_id" = ${worldId.toLowerCase()}
          AND "disabled" IS FALSE
      `
    )
  }

  /**
   * The enabled world places and every parcel the world is known to have held, as one reading.
   *
   * A full-world undeployment needs both, and both have to predate the survivor set read from the
   * content server: a deployment committing after that read is something the survivor set cannot
   * describe, so it must neither be disabled nor have its parcels retired. Disabled rows contribute
   * parcels because they are exactly the ones a disabling statement skips and so cannot tombstone by
   * identity.
   */
  static async findWorldPlaceSnapshot(worldId: string): Promise<{
    revisions: Array<{ id: string; deployment_id: string | null }>
    positions: string[]
  }> {
    const rows = await this.namedQuery<{
      id: string
      deployment_id: string | null
      disabled: boolean
      positions: string[]
    }>(
      "find_world_place_snapshot",
      SQL`
        SELECT "id", "deployment_id", "disabled", "positions"
        FROM ${table(this)}
        WHERE "world" IS TRUE
          AND "world_id" = ${worldId.toLowerCase()}
      `
    )

    return {
      revisions: rows
        .filter((row) => !row.disabled)
        .map(({ id, deployment_id }) => ({ id, deployment_id })),
      positions: [...new Set(rows.flatMap((row) => row.positions))],
    }
  }

  /**
   * Check for an active world scene overlapping the supplied positions that was deployed after
   * the incoming deployment. PostgreSQL performs the comparison so timestamp-without-time-zone
   * values never cross the JavaScript date boundary before ordering is decided.
   */
  static async hasNewerActiveWorldDeployment(
    worldId: string,
    positions: string[],
    deployedAt: Date
  ): Promise<boolean> {
    if (positions.length === 0) {
      return false
    }

    const sql = SQL`
      SELECT EXISTS (
        SELECT 1
        FROM ${table(this)}
        WHERE ("disabled" is false OR "disabled_reason" = 'opt_out')
          AND "world" is true
          AND "world_id" = ${worldId}
          AND "positions" && ${positions}
          AND "deployed_at" > ${deployedAt}
      ) AS "exists"
    `
    const results = await this.namedQuery<{ exists: boolean }>(
      "has_newer_active_world_deployment",
      sql
    )
    return results[0]?.exists ?? false
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
    const sql = SQL`
      UPDATE ${table(this)}
      SET "disabled" = TRUE, "disabled_at" = ${now}, "updated_at" = ${now}, "disabled_reason" = 'overwritten'
      WHERE "id" = ANY(${placesIds})
    `
    await this.namedQuery("disable_places", sql)
  }

  /**
   * Disable candidate world places replaced by a deployment and return the rows actually changed.
   * Accepted deployments replace ties; discarded deployments only carry removals for strictly
   * older rows.
   */
  static async disableReplacedWorldPlaces(
    placesIds: string[],
    replacingDeployedAt: Date,
    includeEqualTimestamp: boolean
  ): Promise<PlaceAttributes[]> {
    if (placesIds.length === 0) {
      return []
    }

    const now = new Date()
    const agePredicate = includeEqualTimestamp
      ? SQL`"deployed_at" <= ${replacingDeployedAt}`
      : SQL`"deployed_at" < ${replacingDeployedAt}`
    const sql = SQL`
      UPDATE ${table(this)}
      SET "disabled" = TRUE,
        "disabled_at" = ${now},
        "updated_at" = ${now},
        "disabled_reason" = 'overwritten'
      WHERE "id" = ANY(${placesIds})
        AND ("disabled" is false OR "disabled_reason" = 'opt_out')
        AND ${agePredicate}
      RETURNING *
    `
    return this.namedQuery<PlaceAttributes>(
      "disable_replaced_world_places",
      sql
    )
  }

  static async updateDisabled(
    placeId: string,
    disabled: boolean,
    reason: DisabledReason | null,
    now: Date = new Date()
  ) {
    const sql = SQL`
      UPDATE ${table(this)}
      SET "disabled" = ${disabled},
        "disabled_at" = ${disabled ? now : null},
        "disabled_reason" = ${disabled ? reason : null},
        "updated_at" = ${now}
      WHERE "id" = ${placeId}
    `
    await this.namedQuery("update_disabled", sql)
  }

  /**
   * Disable the place records of an undeployed world, except the ones the content server still
   * serves. A world undeployment names no scenes, and its timestamp is the moment the removal was
   * emitted, so it is always later than the entity timestamp of a deployment that replaced the
   * world's previous scene set: without the upstream scene set, a replacement would look older than
   * the undeployment and be disabled along with what it replaced.
   *
   * Deployment ids identify surviving scenes exactly. Legacy rows carry none, so they fall back to
   * overlapping the footprint of a surviving scene, which keeps a stale row enabled where a live
   * scene covers its parcels; reconciling those is what bin/rebuildWorldPlaces.ts is for.
   *
   * A snapshot restricts this to rows that existed, unchanged, when the survivor set was read, for
   * the same reason the scene path needs it: every match here is inferred, so a row the survivor set
   * predates cannot be judged by it. Pass null when the world serves nothing, where there is no
   * survivor to spare and the per-world lock's ordering is the whole contract.
   *
   * Ties go to the undeployment, matching the watermark predicates in WorldUndeploymentModel and
   * WorldSceneUndeploymentModel, so an equally timestamped deployment reaches the same state
   * whichever order it arrives in.
   */
  static async disableByWorldId(
    worldId: string,
    eventTimestamp: number,
    liveDeploymentIds: string[],
    livePositions: string[],
    snapshot: Array<{ id: string; deployment_id: string | null }> | null
  ): Promise<PlaceAttributes[]> {
    const normalizedWorldId = worldId.toLowerCase()
    const eventDate = new Date(eventTimestamp)
    const now = new Date()
    const sql = SQL`
      UPDATE ${table(this)} target
      SET "disabled" = TRUE, "disabled_at" = ${now}, "updated_at" = ${now}, "disabled_reason" = 'undeployment'
      WHERE target."world_id" = ${normalizedWorldId}
        AND target."deployed_at" <= ${eventDate}
        AND target."disabled" IS FALSE
        AND ${removedUpstream(liveDeploymentIds, livePositions)}
        ${conditional(
          snapshot !== null,
          SQL`AND ${withinSnapshot(snapshot ?? [])}`
        )}
      RETURNING target.*
    `
    return this.namedQuery<PlaceAttributes>("disable_by_world_id", sql)
  }

  /**
   * Disable world-scene places by immutable deployment id or overlap with the authoritative
   * undeployed footprint. The base-position fallback supports legacy events and rows; rows created
   * before deployment ids were stored use that fallback only when the base identifies exactly one
   * active row.
   *
   * None of those predicates can tell a replaced scene from its replacement: the event's timestamp
   * is when the removal was emitted, so it is later than the replacement's entity timestamp, and the
   * replacement occupies the base and parcels the replaced scene used to. The scenes the content
   * server still serves are therefore excluded first, by deployment id where the row has one and by
   * footprint overlap for legacy rows that do not.
   *
   * Ties go to the undeployment, matching the watermark predicates, so an equally timestamped
   * deployment reaches the same state whichever order it arrives in.
   */
  static async disableByWorldIdAndDeployments(
    worldId: string,
    deploymentIds: string[],
    basePositions: string[],
    positions: string[],
    eventTimestamp: number,
    liveDeploymentIds: string[],
    livePositions: string[],
    snapshot: Array<{ id: string; deployment_id: string | null }>
  ): Promise<{ deploymentIdMatches: number; legacyBaseMatches: number }> {
    const normalizedWorldId = worldId.toLowerCase()
    const eventDate = new Date(eventTimestamp)
    const now = new Date()
    const sql = SQL`
      UPDATE ${table(this)} target
      SET "disabled" = TRUE, "disabled_at" = ${now}, "updated_at" = ${now}, "disabled_reason" = 'undeployment'
      WHERE target."world_id" = ${normalizedWorldId}
        AND target."deployed_at" <= ${eventDate}
        AND target."disabled" IS FALSE
        AND ${removedUpstream(liveDeploymentIds, livePositions)}
        AND (
          target."deployment_id" = ANY(${deploymentIds})
          OR (
            ${withinSnapshot(snapshot)}
            AND (
              target."positions" && ${positions}::varchar[]
              OR (
                target."base_position" = ANY(${basePositions})
                AND (
                  target."deployment_id" IS NOT NULL
                  OR NOT EXISTS (
                    SELECT 1
                    FROM ${table(this)} conflicting
                    WHERE conflicting."world_id" = target."world_id"
                      AND conflicting."base_position" = target."base_position"
                      AND conflicting."disabled" IS FALSE
                      AND conflicting."id" <> target."id"
                  )
                )
              )
            )
          )
        )
      RETURNING target."deployment_id"
    `
    const disabled = await this.namedQuery<{ deployment_id: string | null }>(
      "disable_by_world_id_and_deployments",
      sql
    )
    return {
      deploymentIdMatches: disabled.filter((row) => row.deployment_id !== null)
        .length,
      legacyBaseMatches: disabled.filter((row) => row.deployment_id === null)
        .length,
    }
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

  private static buildUpdatePlaceQuery(
    place: Partial<PlaceAttributes>,
    attributes: Array<keyof PlaceAttributes>,
    rejectOlderDeployment = false
  ): SQLStatement {
    const keys = unique(diff(attributes, ["id", "created_at"])) as Array<
      keyof PlaceAttributes
    >
    return SQL`UPDATE ${table(this)} SET ${setColumns(
      keys,
      place
    )} WHERE ${conditional(
      !place.world,
      SQL`disabled is false AND world is false AND "id" = ${place.id}`
    )}
    ${conditional(
      !!place.world,
      SQL`world is true AND "id" = ${place.id} AND ("disabled" IS FALSE OR "disabled_reason" = 'opt_out')`
    )}
    ${conditional(
      rejectOlderDeployment,
      SQL`AND ("deployed_at" IS NULL OR "deployed_at" <= ${place.deployed_at})`
    )}`
  }

  static updatePlace = (
    place: Partial<PlaceAttributes>,
    attributes: Array<keyof PlaceAttributes>
  ) => {
    return this.namedQuery(
      "update_place",
      this.buildUpdatePlaceQuery(place, attributes)
    )
  }

  /**
   * Store a new deployment revision on an existing place, rejecting the write when the stored row
   * already holds a newer revision. Returns the number of updated rows: 0 means the write was stale.
   */
  static async updatePlaceFromDeployment(
    place: Partial<PlaceAttributes>,
    attributes: Array<keyof PlaceAttributes>
  ): Promise<number> {
    return this.namedRowCount(
      "update_place_from_deployment",
      this.buildUpdatePlaceQuery(place, attributes, true)
    )
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
          sanitizeSearch(options.search || "")
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
          sanitizeSearch(options.search || "")
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
          sanitizeSearch(options.search || "")
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
          sanitizeSearch(options.search || "")
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
}
