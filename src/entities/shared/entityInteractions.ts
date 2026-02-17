import {
  SQL,
  SQLStatement,
  createSearchableMatches,
  join,
  table,
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
function isPlaceId(entityId: string): boolean {
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
