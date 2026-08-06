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
      SET "base_position" = EXCLUDED."base_position",
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
