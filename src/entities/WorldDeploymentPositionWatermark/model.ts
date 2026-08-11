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
 */
export default class WorldDeploymentPositionWatermarkModel extends Model<WorldDeploymentPositionWatermarkAttributes> {
  static tableName = "world_deployment_position_watermarks"

  /**
   * Record the positions covered by a committed deployment, keeping the newest timestamp for
   * each position. PostgreSQL expands one array parameter so large scenes do not generate one
   * bind parameter per parcel.
   */
  static async recordPositions(
    worldId: string,
    positions: string[],
    deployedAt: Date
  ): Promise<void> {
    if (positions.length === 0) {
      return
    }

    const sql = SQL`
      INSERT INTO ${table(this)} ("world_id", "position", "superseded_at")
      SELECT ${worldId.toLowerCase()}, incoming."position", ${deployedAt}
      FROM (
        SELECT DISTINCT unnest(${positions}::text[]) AS "position"
      ) AS incoming
      ON CONFLICT ("world_id", "position") DO UPDATE
      SET "superseded_at" = GREATEST(${table(
        this
      )}."superseded_at", EXCLUDED."superseded_at")
    `

    await this.namedQuery("record_world_deployment_position_watermarks", sql)
  }

  /**
   * Return whether a strictly newer deployment has already covered any incoming position.
   * Equal deployment timestamps keep the existing deployment ordering semantics and are not
   * considered superseding.
   */
  static async hasSupersedingDeployment(
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
        FROM ${table(this)} AS watermark
        JOIN (
          SELECT DISTINCT unnest(${positions}::text[]) AS "position"
        ) AS incoming
          ON incoming."position" = watermark."position"
        WHERE watermark."world_id" = ${worldId.toLowerCase()}
          AND watermark."superseded_at" > ${deployedAt}
      ) AS "exists"
    `

    const results = await this.namedQuery<{ exists: boolean }>(
      "has_superseding_world_deployment_position_watermark",
      sql
    )
    return results[0]?.exists ?? false
  }
}
