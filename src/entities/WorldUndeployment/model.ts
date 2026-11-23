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
   * Record that a world was undeployed from a worlds server, keeping the newest event timestamp.
   */
  static async recordWatermark(
    worldId: string,
    contentServerUrl: string,
    eventTimestamp: number
  ): Promise<void> {
    const normalizedWorldId = worldId.toLowerCase()
    const undeployedAt = new Date(eventTimestamp)
    const sql = SQL`
      INSERT INTO ${table(
        this
      )} ("world_id", "content_server_url", "undeployed_at")
      VALUES (${normalizedWorldId}, ${contentServerUrl}, ${undeployedAt})
      ON CONFLICT ("world_id", "content_server_url") DO UPDATE
      SET "undeployed_at" = GREATEST(${table(
        this
      )}."undeployed_at", EXCLUDED."undeployed_at")
    `

    await this.namedQuery("record_world_undeployment", sql)
  }

  /**
   * Find the world undeployment that supersedes a deployment, if any. Both sides are stamped by the
   * worlds content server when it emits the event, so a deployment emitted after the undeployment is
   * kept however long before it the entity was signed. Only an undeployment from the server the
   * deployment was made to counts: another server may still serve the same world name. Returns
   * null when the world was never undeployed there or the deployment was emitted later.
   */
  static async findSupersedingUndeployment(
    worldId: string,
    contentServerUrl: string,
    emittedAt: Date
  ): Promise<WorldUndeploymentAttributes | null> {
    const sql = SQL`
      SELECT * FROM ${table(this)}
      WHERE "world_id" = ${worldId.toLowerCase()}
        AND "content_server_url" = ${contentServerUrl}
        AND "undeployed_at" >= ${emittedAt}
    `

    const results = await this.namedQuery<WorldUndeploymentAttributes>(
      "find_superseding_world_undeployment",
      sql
    )
    return results[0] || null
  }
}
