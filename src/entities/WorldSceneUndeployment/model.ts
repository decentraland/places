import {
  SQL,
  join,
  table,
} from "decentraland-gatsby/dist/entities/Database/utils"

import { UndeployedScene, WorldSceneUndeploymentAttributes } from "./types"
import { Model } from "../Database/model"

/**
 * Durable record of scene undeployments. A place row alone cannot carry this, because an
 * undeployment can arrive before the deployment it refers to, leaving no row to mark.
 */
export default class WorldSceneUndeploymentModel extends Model<WorldSceneUndeploymentAttributes> {
  static tableName = "world_scene_undeployments"

  /**
   * Record the undeployed scenes for a world, keeping the newest event timestamp per deployment.
   *
   * A deployment id is a content hash over the scene metadata the base parcel is derived from,
   * so repeat events for one scene carry the same base. The base is still only taken from an
   * event at least as new as the stored one, so a delayed event can never pair its own base with
   * a newer timestamp: replay rejection matches on base position too, and a mismatched pair
   * would weaken that match for older revisions at the real undeployed base.
   */
  static async recordScenes(
    worldId: string,
    scenes: UndeployedScene[],
    eventTimestamp: number
  ): Promise<void> {
    if (scenes.length === 0) {
      return
    }

    const normalizedWorldId = worldId.toLowerCase()
    const undeployedAt = new Date(eventTimestamp)
    const values = join(
      scenes.map(
        (scene) =>
          SQL`(${normalizedWorldId}, ${scene.entityId}, ${scene.baseParcel}, ${undeployedAt})`
      )
    )

    const sql = SQL`
      INSERT INTO ${table(
        this
      )} ("world_id", "deployment_id", "base_position", "undeployed_at")
      VALUES ${values}
      ON CONFLICT ("world_id", "deployment_id") DO UPDATE
      SET "base_position" = CASE
            WHEN EXCLUDED."undeployed_at" >= ${table(this)}."undeployed_at"
            THEN EXCLUDED."base_position"
            ELSE ${table(this)}."base_position"
          END,
          "undeployed_at" = GREATEST(${table(
            this
          )}."undeployed_at", EXCLUDED."undeployed_at")
    `

    await this.namedQuery("record_scene_undeployments", sql)
  }

  /**
   * Find the undeployment that supersedes an incoming deployment, matching either the exact
   * deployment identity or the scene's base position, so an older revision of an undeployed
   * scene cannot be recreated either. Returns null when the deployment is newer than every
   * recorded undeployment for that scene.
   */
  static async findSupersedingUndeployment(
    worldId: string,
    deploymentId: string,
    basePosition: string,
    deployedAt: Date
  ): Promise<WorldSceneUndeploymentAttributes | null> {
    const sql = SQL`
      SELECT * FROM ${table(this)}
      WHERE "world_id" = ${worldId.toLowerCase()}
        AND ("deployment_id" = ${deploymentId} OR "base_position" = ${basePosition})
        AND "undeployed_at" >= ${deployedAt}
      ORDER BY "undeployed_at" DESC
      LIMIT 1
    `

    const results = await this.namedQuery<WorldSceneUndeploymentAttributes>(
      "find_superseding_undeployment",
      sql
    )
    return results[0] || null
  }
}
