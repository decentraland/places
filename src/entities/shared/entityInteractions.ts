import {
  SQL,
  SQLStatement,
  conditional,
  createSearchableMatches,
  join,
  table,
  tsquery,
} from "decentraland-gatsby/dist/entities/Database/utils"

import { AggregateBaseEntityAttributes } from "./types"
import PlaceModel from "../Place/model"
import UserFavoriteModel from "../UserFavorite/model"
import UserLikesModel from "../UserLikes/model"
import WorldModel from "../World/model"

/**
 * Minimum user activity threshold for likes to be counted in like_rate and like_score
 */
export const MIN_USER_ACTIVITY = 100

/**
 * Type for models that can have their interactions updated
 */
type EntityModel = { tableName: string }

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Determine whether an entity ID corresponds to a place (UUID) or a world (name like "name.dcl.eth").
 */
export function isPlaceId(entityId: string): boolean {
  return UUID_REGEX.test(entityId)
}

/**
 * Find an entity (place or world) by its ID along with user-specific aggregate data.
 * Uses the entity ID format to determine which model to query:
 * - UUIDs are looked up as places
 * - Non-UUID strings (e.g. "name.dcl.eth") are looked up as worlds
 */
export async function findEntityByIdWithAggregates(
  entityId: string,
  options: { user: string | undefined }
): Promise<AggregateBaseEntityAttributes | null> {
  if (isPlaceId(entityId)) {
    return PlaceModel.findByIdWithAggregates(entityId, options)
  }

  return WorldModel.findByIdWithAggregates(entityId, options)
}

/**
 * Common fields used for full-text search in both places and worlds
 */
type TextsearchableEntity = {
  title: string | null
  world_name: string | null
  description: string | null
  owner: string | null
}

/**
 * Build a PostgreSQL tsvector for full-text search on an entity.
 * Uses weighted vectors for ranking:
 * - Weight 'A' (highest): title, world_name
 * - Weight 'B' (medium): description
 * - Weight 'C' (lowest): owner
 */
export function buildTextsearch(entity: TextsearchableEntity): SQLStatement {
  return SQL`(${join(
    [
      SQL`setweight(to_tsvector(coalesce(${entity.title}, '')), 'A')`,
      SQL`setweight(to_tsvector(coalesce(${entity.world_name}, '')), 'A')`,
      SQL`setweight(to_tsvector(coalesce(${entity.description}, '')), 'B')`,
      SQL`setweight(to_tsvector(${createSearchableMatches(
        entity.description || ""
      )}), 'B')`,
      SQL`setweight(to_tsvector(coalesce(${entity.owner}, '')), 'C')`,
    ],
    SQL` || `
  )})`
}

/**
 * Calculate like score using Wilson score interval.
 * This provides a statistically robust way to rank items by rating.
 * We're calculating the lower bound of a 95% confidence interval.
 *
 * For reference: https://www.evanmiller.org/how-not-to-sort-by-average-rating.html
 *
 * Note: This returns a SQL fragment that expects a CTE with columns:
 * - c.count_active_likes
 * - c.count_active_dislikes
 */
export function calculateLikeScoreStatement(): SQLStatement {
  return SQL`CASE WHEN (c.count_active_likes + c.count_active_dislikes > 0) THEN 
    ((c.count_active_likes + 1.9208)
    / (c.count_active_likes + c.count_active_dislikes) - 1.96
    * SQRT((c.count_active_likes * c.count_active_dislikes) / (c.count_active_likes + c.count_active_dislikes) + 0.9604)
    / (c.count_active_likes + c.count_active_dislikes))
    / (1 + 3.8416 / (c.count_active_likes + c.count_active_dislikes)) 
  ELSE NULL END`
}

/**
 * Build SQL query to update favorites count for an entity (place or world).
 * Counts all favorites for the entity and updates the denormalized count.
 */
export function buildUpdateFavoritesQuery(
  model: EntityModel,
  entityId: string
): SQLStatement {
  const tableName = SQL.raw(`"${model.tableName}"`)
  return SQL`
    WITH counted AS (
      SELECT count(*) AS count
      FROM ${table(UserFavoriteModel)}
      WHERE entity_id = ${entityId}
    )
    UPDATE ${tableName}
    SET favorites = c.count
    FROM counted c
    WHERE id = ${entityId}
  `
}

/**
 * Build SQL query to update likes, dislikes, like_rate, and like_score for an entity.
 * Counts all likes/dislikes and calculates rates based on active users only.
 */
export function buildUpdateLikesQuery(
  model: EntityModel,
  entityId: string
): SQLStatement {
  const tableName = SQL.raw(`"${model.tableName}"`)
  return SQL`
    WITH counted AS (
      SELECT
        count(*) filter (where "like") as count_likes,
        count(*) filter (where not "like") as count_dislikes,
        count(*) filter (where user_activity >= ${MIN_USER_ACTIVITY}) as count_active_total,
        count(*) filter (where "like" and user_activity >= ${MIN_USER_ACTIVITY}) as count_active_likes,
        count(*) filter (where not "like" and user_activity >= ${MIN_USER_ACTIVITY}) as count_active_dislikes
      FROM ${table(UserLikesModel)}
      WHERE entity_id = ${entityId}
    )
    UPDATE ${tableName}
    SET
      likes = c.count_likes,
      dislikes = c.count_dislikes,
      like_rate = (CASE WHEN c.count_active_total::float = 0 THEN NULL
                        ELSE c.count_active_likes / c.count_active_total::float
                  END),
      like_score = (${calculateLikeScoreStatement()})
    FROM counted c
    WHERE id = ${entityId}
  `
}

/**
 * Build SQL SELECT fragments for user interaction columns (user_favorite, user_like, user_dislike).
 * These reference the `uf` and `ul` table aliases from the corresponding JOINs.
 *
 * @param user - The user address, or undefined if no user context
 * @param forCount - When true, returns empty (count queries don't need these columns)
 */
export function buildUserInteractionColumns(
  user: string | undefined,
  forCount: boolean
): SQLStatement {
  if (forCount) return SQL``
  return SQL`
    ${conditional(!!user, SQL`, uf."user" is not null as user_favorite`)}
    ${conditional(!user, SQL`, false as user_favorite`)}
    ${conditional(!!user, SQL`, coalesce(ul."like",false) as "user_like"`)}
    ${conditional(!user, SQL`, false as "user_like"`)}
    ${conditional(
      !!user,
      SQL`, not coalesce(ul."like",true) as "user_dislike"`
    )}
    ${conditional(!user, SQL`, false as "user_dislike"`)}
  `
}

/**
 * Build SQL JOIN fragments for user favorites and user likes tables.
 *
 * @param entityIdExpr - SQL expression for the entity ID column (e.g., SQL`p.id` or SQL`w.id`)
 * @param user - The user address, or undefined if no user context
 * @param options.onlyFavorites - When true, uses RIGHT JOIN for favorites (filtering to favorites only)
 * @param options.forCount - When true, only includes the favorites join (count queries skip likes)
 */
export function buildUserInteractionJoins(
  entityIdExpr: SQLStatement,
  user: string | undefined,
  options: { onlyFavorites: boolean; forCount: boolean }
): SQLStatement {
  return SQL`
    ${conditional(
      !!user && !options.onlyFavorites && !options.forCount,
      SQL`LEFT JOIN ${table(
        UserFavoriteModel
      )} uf on ${entityIdExpr} = uf.entity_id AND uf."user" = ${user}`
    )}
    ${conditional(
      !!user && options.onlyFavorites,
      SQL`RIGHT JOIN ${table(
        UserFavoriteModel
      )} uf on ${entityIdExpr} = uf.entity_id AND uf."user" = ${user}`
    )}
    ${conditional(
      !!user && !options.forCount,
      SQL`LEFT JOIN ${table(
        UserLikesModel
      )} ul on ${entityIdExpr} = ul.entity_id AND ul."user" = ${user}`
    )}
  `
}

/**
 * Build the inline tsvector text search rank expression for worlds.
 * Worlds don't have a stored `textsearch` column, so we build the tsvector inline.
 *
 * @param alias - Table alias for the worlds table (e.g., "w")
 * @param search - The search string to rank against
 */
export function buildWorldTextSearchRank(
  alias: string,
  search: string
): SQLStatement {
  const a = SQL.raw(alias)
  return SQL`ts_rank_cd(
    (setweight(to_tsvector(coalesce(${a}.title, '')), 'A') ||
     setweight(to_tsvector(coalesce(${a}.world_name, '')), 'A') ||
     setweight(to_tsvector(coalesce(${a}.description, '')), 'B') ||
     setweight(to_tsvector(coalesce(${a}.owner, '')), 'C')),
    to_tsquery(${tsquery(search || "")})
  )`
}
