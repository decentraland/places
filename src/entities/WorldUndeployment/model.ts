import { SQL, table } from "decentraland-gatsby/dist/entities/Database/utils"

import { WorldUndeploymentAttributes } from "./types"
import { Model } from "../Database/model"

/**
 * Durable watermark of full-world undeployments. Kept out of the worlds table because world
 * queries select every column, and this is internal ingestion state rather than public data.
 */
export default class WorldUndeploymentModel extends Model<WorldUndeploymentAttributes> {
  static tableName = "world_undeployments"

  /**
   * Record that a world was undeployed, keeping the newest event timestamp.
   */
  static async recordWatermark(
    worldId: string,
    eventTimestamp: number
  ): Promise<void> {
    const normalizedWorldId = worldId.toLowerCase()
    const undeployedAt = new Date(eventTimestamp)
    const sql = SQL`
      INSERT INTO ${table(this)} ("world_id", "undeployed_at")
      VALUES (${normalizedWorldId}, ${undeployedAt})
      ON CONFLICT ("world_id") DO UPDATE
      SET "undeployed_at" = GREATEST(${table(
        this
      )}."undeployed_at", EXCLUDED."undeployed_at")
    `

    await this.namedQuery("record_world_undeployment", sql)
  }

  /**
   * Find the world undeployment that supersedes a deployment, if any. Returns null when the
   * deployment is newer than the last undeployment, or when the world was never undeployed.
   */
  static async findSupersedingUndeployment(
    worldId: string,
    deployedAt: Date
  ): Promise<WorldUndeploymentAttributes | null> {
    const sql = SQL`
      SELECT * FROM ${table(this)}
      WHERE "world_id" = ${worldId.toLowerCase()}
        AND "undeployed_at" >= ${deployedAt}
    `

    const results = await this.namedQuery<WorldUndeploymentAttributes>(
      "find_superseding_world_undeployment",
      sql
    )
    return results[0] || null
  }
}
