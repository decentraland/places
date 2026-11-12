import {
  SQL,
  SQLStatement,
  conditional,
  limit,
  offset,
} from "decentraland-gatsby/dist/entities/Database/utils"
import { oneOf } from "decentraland-gatsby/dist/entities/Schema/utils"

import {
  AggregateDestinationAttributes,
  FindDestinationsWithAggregatesOptions,
} from "./types"
import PlaceModel from "../Place/model"
import { PlaceListOrderBy } from "../Place/types"
import WorldModel from "../World/model"

/**
 * Explicit SELECT columns for places in destination queries.
 * Provides sensible defaults for fields that don't exist on places
 * (e.g., `false as world`, `false as is_private`, `0 as user_visits`).
 */
const PLACES_DESTINATION_SELECT = SQL`
  p.id, p.title, p.description, p.image, p.owner, p.world_name,
  p.content_rating, p.categories, p.likes, p.dislikes, p.favorites,
  p.like_rate, p.like_score, p.disabled, p.disabled_at,
  p.created_at, p.updated_at,
  p.base_position, p.contact_name, p.deployed_at,
  p.highlighted, false as world, false as is_private,
  p.highlighted_image, p.positions, p.contact_email,
  p.creator_address, p.sdk, p.ranking,
  0 as user_visits`

/**
 * Explicit SELECT columns for worlds in destination queries.
 * Maps world columns to the unified DestinationAttributes shape,
 * using the lateral join (lp) for place-derived fields.
 */
const WORLDS_DESTINATION_SELECT = SQL`
  w.id, w.title, w.description, COALESCE(w.image, lp.image) as image,
  w.owner, w.world_name,
  w.content_rating, w.categories, w.likes, w.dislikes, w.favorites,
  w.like_rate, w.like_score, false as disabled, null::timestamptz as disabled_at,
  w.created_at, w.updated_at,
  '0,0' as base_position, lp.contact_name, lp.deployed_at,
  w.highlighted, true as world, w.is_private,
  w.highlighted_image, '{}'::varchar[] as positions,
  lp.contact_email, lp.creator_address, lp.sdk, w.ranking,
  0 as user_visits`

/** Fallback when there is no realtime data: every destination ranks as 0 active users. */
const ZERO_LIVE_USER_COUNT = SQL`, 0::int as live_user_count`

/**
 * Build a `live_user_count` SELECT column for places from the realtime hot-scenes counts,
 * matching on `base_position`. Values are bound as query params (no string interpolation).
 * Returns a 0 column when there is no realtime data so the UNION stays column-aligned.
 */
function placesLiveUserCountSelect(
  counts: { base_position: string; count: number }[] | undefined
): SQLStatement {
  if (!counts || counts.length === 0) return ZERO_LIVE_USER_COUNT
  let cases = SQL``
  for (const c of counts)
    cases = SQL`${cases} WHEN ${c.base_position} THEN ${c.count}`
  return SQL`, COALESCE(CASE p.base_position${cases} ELSE 0 END, 0)::int as live_user_count`
}

/**
 * Build a `live_user_count` SELECT column for worlds from the realtime world live-data counts,
 * matching on `world_name` (case-insensitive). Mirrors {@link placesLiveUserCountSelect}.
 */
function worldsLiveUserCountSelect(
  counts: { world_name: string; count: number }[] | undefined
): SQLStatement {
  if (!counts || counts.length === 0) return ZERO_LIVE_USER_COUNT
  let cases = SQL``
  for (const c of counts)
    cases = SQL`${cases} WHEN ${c.world_name.toLowerCase()} THEN ${c.count}`
  return SQL`, COALESCE(CASE LOWER(w.world_name)${cases} ELSE 0 END, 0)::int as live_user_count`
}

/**
 * The subset of the destination filters that decides whether the content-quality filter applies.
 * Every field is optional so both {@link DestinationModel.findWithAggregates} and
 * {@link DestinationModel.count} option shapes satisfy it.
 */
type ContentQualityGateOptions = {
  positions?: string[]
  world_names?: string[]
  names?: string[]
  search?: string
  ids?: string[]
  owner?: string
  creator_address?: string
  only_favorites?: boolean
  only_highlighted?: boolean
}

/**
 * Filters that make the caller's intent narrower than discovery: it is looking up destinations it
 * already knows about, or its own. Hiding a thumbnail-less row from such an answer would read as
 * the destination having disappeared, so the filter steps aside for both entity types.
 *
 * `only_highlighted` is here for the same reason it is redundant: every row it returns is
 * highlighted, which the predicate already keeps.
 */
function isLookupQuery(options: ContentQualityGateOptions): boolean {
  return (
    !!options.search ||
    !!options.ids?.length ||
    !!options.owner ||
    !!options.creator_address ||
    !!options.only_favorites ||
    !!options.only_highlighted
  )
}

/**
 * Whether the places branch should be filtered. `pointer` names the parcels the caller is asking
 * about, so it exempts places only -- the worlds sharing the page were not asked for by name.
 */
function requireContentForPlaces(options: ContentQualityGateOptions): boolean {
  return !isLookupQuery(options) && !options.positions?.length
}

/**
 * Whether the worlds branch should be filtered. `world_names` and `names` both name worlds, so
 * they exempt worlds only, leaving the places branch filtered.
 */
function requireContentForWorlds(options: ContentQualityGateOptions): boolean {
  return (
    !isLookupQuery(options) &&
    !options.world_names?.length &&
    !options.names?.length
  )
}

/**
 * Project the destination options onto the subset {@link WorldModel.buildSubQuery} accepts.
 *
 * The worlds branch takes a narrower shape than the places one -- it has no `positions`, and its
 * name filters are its own -- so every call site used to spell the same projection out by hand.
 * Four copies drifting apart is how one of them ends up missing a filter.
 */
function worldSubQueryOptions(options: {
  user?: string
  only_favorites?: boolean
  search?: string
  categories?: string[]
  only_highlighted?: boolean
  world_names?: string[]
  names?: string[]
  owner?: string
  ids?: string[]
  sdk?: string
  creator_address?: string
}) {
  return {
    user: options.user,
    only_favorites: !!options.only_favorites,
    search: options.search,
    categories: options.categories ?? [],
    only_highlighted: !!options.only_highlighted,
    world_names: options.world_names,
    names: options.names,
    owner: options.owner,
    ids: options.ids,
    sdk: options.sdk,
    creator_address: options.creator_address,
  }
}

export default class DestinationModel {
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

    const filterMostActive = options.order_by === PlaceListOrderBy.MOST_ACTIVE

    // Same reasoning as MOST_ACTIVE below, applied to CREATED_AT: a caller asking for what is new
    // wants that to win over the featured shelf too, not just break a tie underneath it. Unlike
    // MOST_ACTIVE this needs no extra SELECT column — `orderBy` already resolves to `created_at`,
    // already selected above. Derived from the resolved `orderBy`/`orderDirection`, not the raw
    // `options.order_by`/`options.order`, so this can't drift from what actually lands in the SQL
    // if the `oneOf` allowlist above ever changes.
    //
    // UPDATED_AT deliberately does NOT get this override, even though it is accepted right next
    // to CREATED_AT below: the daily ranking rebuild stamps `updated_at = now()` on every row in
    // the eligible (non-highlighted, non-excluded) population on every run, whether or not its
    // ranking actually changed (see `PlaceModel`/`WorldModel.applyRankingReplace`, and
    // `replaceRanking.ts`'s "rebuilds its eligible set from scratch every run"). Promoting that
    // column here would tie most of the catalog together, and the id tiebreak at the bottom of
    // each ORDER BY would decide the effective top of the feed instead of real recency.
    //
    // `order=asc` is excluded too: unlike MOST_ACTIVE (DESC-only in practice — nobody asks for
    // the least active destination), "oldest first" has no "surface what people want" case that
    // justifies outranking curation, and would otherwise put the bottom of the catalog above the
    // featured shelf on a public, unauthenticated endpoint.
    const filterRecency =
      orderBy === PlaceListOrderBy.CREATED_AT && orderDirection === "desc"

    // When ordering by MOST_ACTIVE, expose a `live_user_count` column built from the realtime
    // counts so the query can ORDER BY the actual connected users — places (hot scenes) and
    // worlds (world live data) alike, instead of a hot-scenes-only boolean. See #7344.
    //
    // That column sorts ahead of `highlighted`, so people decide the top of this ordering and
    // curation decides the rest. Asking for the most active destinations and being shown empty
    // ones first reads as the sort being broken, and a visitor picking from this list is looking
    // for somewhere with people in it. Editorial still owns everything below: once nobody is
    // online the order collapses back to exactly the shelf, in exactly the order it was set.
    //
    // This only applies to MOST_ACTIVE; CREATED_AT (descending only) gets the same override via
    // `filterRecency` above, without a `live_user_count`-style extra column. A search query keeps
    // the same trade-off this already makes for MOST_ACTIVE: `rank DESC` (full-text relevance)
    // sits below both overrides, so `search=foo&order_by=created_at` ranks by recency and ignores
    // the text match quality. UPDATED_AT and LIKE_SCORE_BEST are the orderings left that keep the
    // featured shelf on top.
    const placesSelect = filterMostActive
      ? SQL`${PLACES_DESTINATION_SELECT}${placesLiveUserCountSelect(
          options.placeUserCounts
        )}`
      : PLACES_DESTINATION_SELECT
    const worldsSelect = filterMostActive
      ? SQL`${WORLDS_DESTINATION_SELECT}${worldsLiveUserCountSelect(
          options.worldUserCounts
        )}`
      : WORLDS_DESTINATION_SELECT

    // The generic feed hides destinations that carry no information of their own. Decided per
    // entity branch and shared with count() so the totals match the listing.
    const placesRequireContent = requireContentForPlaces(options)
    const worldsRequireContent = requireContentForWorlds(options)

    // Every ORDER BY below ends in the row id. Without it the sort is not total: the tail of the
    // feed has `live_user_count`, `ranking` and `like_score` all tied at zero, and `updated_at` is
    // shared by whole batches of rows written together, so Postgres was free to return any
    // permutation of them. It chose differently depending on the plan, and the plan changes with
    // the LIMIT, so the explorer asking for 20 and the web asking for 48 saw different orders from
    // row 8 down. The id breaks every remaining tie and costs nothing, since it is the primary key.

    if (options.only_places) {
      const placesQuery = PlaceModel.buildSubQuery(options, {
        selectColumns: placesSelect,
        worldFilter: "always",
        requireContent: placesRequireContent,
      })
      const sql = SQL`
        ${placesQuery}
        ORDER BY
          ${conditional(filterMostActive, SQL`live_user_count DESC, `)}
          ${conditional(
            filterRecency,
            SQL.raw(`p.${orderBy} ${orderDirection.toUpperCase()} NULLS LAST, `)
          )}
          p.highlighted DESC,
          p.ranking DESC NULLS LAST,
          ${conditional(!!options.search, SQL`rank DESC, `)}
          ${conditional(
            !filterRecency,
            SQL.raw(`p.${orderBy} ${orderDirection.toUpperCase()} NULLS LAST, `)
          )}
          p."deployed_at" DESC, p.id ASC
        ${limit(options.limit, { max: 100 })}
        ${offset(options.offset)}
      `
      return PlaceModel.namedQuery<AggregateDestinationAttributes>(
        "find_destinations_places",
        sql
      )
    }

    if (options.only_worlds) {
      const worldsQuery = WorldModel.buildSubQuery(
        worldSubQueryOptions(options),
        {
          selectColumns: worldsSelect,
          requireContent: worldsRequireContent,
        }
      )
      const sql = SQL`
        ${worldsQuery}
        ORDER BY
          ${conditional(filterMostActive, SQL`live_user_count DESC, `)}
          ${conditional(
            filterRecency,
            SQL.raw(`w.${orderBy} ${orderDirection.toUpperCase()} NULLS LAST, `)
          )}
          w.highlighted DESC,
          w.ranking DESC NULLS LAST,
          ${conditional(!!options.search, SQL`rank DESC, `)}
          ${conditional(
            !filterRecency,
            SQL.raw(`w.${orderBy} ${orderDirection.toUpperCase()} NULLS LAST, `)
          )}
          w.updated_at DESC, w.id ASC
        ${limit(options.limit, { max: 100 })}
        ${offset(options.offset)}
      `
      return WorldModel.namedQuery<AggregateDestinationAttributes>(
        "find_destinations_worlds",
        sql
      )
    }

    // UNION ALL strategy (both subqueries must have the same columns; both add live_user_count when order_by=most_active)
    const placesQuery = PlaceModel.buildSubQuery(options, {
      selectColumns: placesSelect,
      worldFilter: "always",
      requireContent: placesRequireContent,
    })
    const worldsQuery = WorldModel.buildSubQuery(
      worldSubQueryOptions(options),
      {
        selectColumns: worldsSelect,
        requireContent: worldsRequireContent,
      }
    )

    const sql = SQL`
      SELECT * FROM (
        (${placesQuery})
        UNION ALL
        (${worldsQuery})
      ) sub
      ORDER BY
        ${conditional(filterMostActive, SQL`sub.live_user_count DESC, `)}
        ${conditional(
          filterRecency,
          SQL.raw(`sub.${orderBy} ${orderDirection.toUpperCase()} NULLS LAST, `)
        )}
        sub.highlighted DESC,
        sub.ranking DESC NULLS LAST,
        ${conditional(!!options.search, SQL`sub.rank DESC, `)}
        ${conditional(
          !filterRecency,
          SQL.raw(`sub.${orderBy} ${orderDirection.toUpperCase()} NULLS LAST, `)
        )}
        sub.updated_at DESC, sub.id ASC
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

    // Same decision as findWithAggregates, from the same helpers: a total that counted rows the
    // listing hides would paginate past the end of the feed.
    const placesRequireContent = requireContentForPlaces(fullOptions)
    const worldsRequireContent = requireContentForWorlds(fullOptions)

    if (options.only_places) {
      const placesQuery = PlaceModel.buildSubQuery(fullOptions, {
        forCount: true,
        worldFilter: "always",
        requireContent: placesRequireContent,
      })
      const sql = SQL`SELECT count(*) as total FROM (${placesQuery}) sub`
      const results: { total: string }[] = await PlaceModel.namedQuery(
        "count_destinations_places",
        sql
      )
      return Number(results[0].total)
    }

    if (options.only_worlds) {
      const worldsQuery = WorldModel.buildSubQuery(
        worldSubQueryOptions(fullOptions),
        { forCount: true, requireContent: worldsRequireContent }
      )
      const sql = SQL`SELECT count(*) as total FROM (${worldsQuery}) sub`
      const results: { total: string }[] = await WorldModel.namedQuery(
        "count_destinations_worlds",
        sql
      )
      return Number(results[0].total)
    }

    // UNION ALL count
    const placesQuery = PlaceModel.buildSubQuery(fullOptions, {
      forCount: true,
      worldFilter: "always",
      requireContent: placesRequireContent,
    })
    const worldsQuery = WorldModel.buildSubQuery(
      worldSubQueryOptions(fullOptions),
      { forCount: true, requireContent: worldsRequireContent }
    )

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
}
