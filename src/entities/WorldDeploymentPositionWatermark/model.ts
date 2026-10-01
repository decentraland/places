import { SQL, table } from "decentraland-gatsby/dist/entities/Database/utils"

import { WorldDeploymentPositionWatermarkAttributes } from "./types"
import { Model } from "../Database/model"

/**
 * Durable high-watermark for deployments that replaced older content at a world position.
 *
 * A deployment can arrive after a newer deployment and therefore never create a place row,
 * but it still retired every older scene overlapping its footprint upstream. Keeping only the
 * newest deployment timestamp per position captures that removal without retaining one record
 * for every deployment or requiring the replaced scenes to have reached Places first.
 *
 * Removal events clear positions too, on a different clock: the worlds content server stamps them
 * when it emits them, so they are kept apart in `removed_at`.
 */
export default class WorldDeploymentPositionWatermarkModel extends Model<WorldDeploymentPositionWatermarkAttributes> {
  static tableName = "world_deployment_position_watermarks"

  /**
   * Record the positions covered by a committed deployment, keeping the newest entity timestamp
   * for each position. PostgreSQL expands one array parameter so large scenes do not generate one
   * bind parameter per parcel.
   */
  static async recordPositions(
    worldId: string,
    positions: string[],
    deployedAt: Date
  ): Promise<void> {
    await this.recordWatermarks(worldId, positions, "superseded_at", deployedAt)
  }

  /**
   * Record the positions a removal cleared, keeping the newest moment the worlds content server
   * emitted a removal for each. Compared against a deployment's emission time, never its entity
   * timestamp, which the client sets up to the deployment TTL before the deployment commits.
   */
  static async recordRemovals(
    worldId: string,
    positions: string[],
    removedAt: Date
  ): Promise<void> {
    await this.recordWatermarks(worldId, positions, "removed_at", removedAt)
  }

  private static async recordWatermarks(
    worldId: string,
    positions: string[],
    clock: "superseded_at" | "removed_at",
    stampedAt: Date
  ): Promise<void> {
    if (positions.length === 0) {
      return
    }

    const watermarks = table(this)
    const column = SQL.raw(`"${clock}"`)

    const sql = SQL`
      INSERT INTO ${watermarks} ("world_id", "position", ${column})
      SELECT ${worldId.toLowerCase()}, incoming."position", ${stampedAt}::timestamp
      FROM (
        SELECT DISTINCT unnest(${positions}::text[]) AS "position"
      ) AS incoming
      ON CONFLICT ("world_id", "position") DO UPDATE
      SET ${column} = GREATEST(${watermarks}.${column}, EXCLUDED.${column})
    `

    await this.namedQuery(`record_world_position_watermarks_${clock}`, sql)
  }

  /**
   * Return whether a deployment or a removal has already retired any incoming position: a
   * strictly newer deployment by entity timestamp, or a removal emitted at or after this
   * deployment. Ties go to the removal, matching the other removal watermarks.
   */
  static async hasSupersedingDeployment(
    worldId: string,
    positions: string[],
    deployedAt: Date,
    emittedAt: Date
  ): Promise<boolean> {
    if (positions.length === 0) {
      return false
    }

    const sql = SQL`
      SELECT EXISTS (
        SELECT 1
        FROM ${table(this)} AS watermark
        JOIN (
          SELECT DISTINCT unnest(${positions}::text[]) AS "position"
        ) AS incoming
          ON incoming."position" = watermark."position"
        WHERE watermark."world_id" = ${worldId.toLowerCase()}
          AND (
            watermark."superseded_at" > ${deployedAt}
            OR watermark."removed_at" >= ${emittedAt}
          )
      ) AS "exists"
    `

    const results = await this.namedQuery<{ exists: boolean }>(
      "has_superseding_world_deployment_position_watermark",
      sql
    )
    return results[0]?.exists ?? false
  }
}
