import { SQL, table } from "decentraland-gatsby/dist/entities/Database/utils"

import { UndeployedScene, WorldSceneUndeploymentAttributes } from "./types"
import { Model } from "../Database/model"

/**
 * Durable record of scene undeployments. A place row alone cannot carry this, because an
 * undeployment can arrive before the deployment it refers to, leaving no row to mark.
 */
export default class WorldSceneUndeploymentModel extends Model<WorldSceneUndeploymentAttributes> {
  static tableName = "world_scene_undeployments"

  /**
   * Record the undeployed scenes for a world, keeping the newest timestamp per deployment.
   *
   * Each scene also states whether its base parcel may reject: false when a replacement already
   * served that base, which keeps the row an identity-only tombstone.
   *
   * Each scene carries the tightest bound its caller could establish: the deployment timestamp of
   * the content that was removed when that is known, and the moment the removal was emitted
   * otherwise. Rejection compares this against an incoming deployment's entity timestamp, and a
   * removal is always emitted after the deployment that caused it, so the emission time retires more
   * than the removal proves. Callers that cannot establish the tighter bound must therefore not
   * record a base parcel something still serves, or the row will reject the deployment serving it.
   *
   * A deployment id is a content hash over the scene metadata the base parcel is derived from,
   * so repeat events for one scene carry the same base. The base is still only taken from an
   * event at least as new as the stored one, so a delayed event can never pair its own base with
   * a newer timestamp: replay rejection matches on base position too, and a mismatched pair
   * would weaken that match for older revisions at the real undeployed base.
   */
  static async recordScenes(
    worldId: string,
    scenes: Array<
      UndeployedScene & { undeployedAt: Date; basePositionRejects: boolean }
    >
  ): Promise<void> {
    if (scenes.length === 0) {
      return
    }

    const normalizedWorldId = worldId.toLowerCase()
    const uniqueScenes = [
      ...new Map(scenes.map((scene) => [scene.entityId, scene])).values(),
    ]
    const deploymentIds = uniqueScenes.map((scene) => scene.entityId)
    const basePositions = uniqueScenes.map((scene) => scene.baseParcel)
    const undeployedAt = uniqueScenes.map((scene) => scene.undeployedAt)
    const basePositionRejects = uniqueScenes.map(
      (scene) => scene.basePositionRejects
    )

    const sql = SQL`
      INSERT INTO ${table(
        this
      )} ("world_id", "deployment_id", "base_position", "undeployed_at", "base_position_rejects")
      SELECT ${normalizedWorldId}, incoming."deployment_id", incoming."base_position", incoming."undeployed_at", incoming."base_position_rejects"
      FROM unnest(
        ${deploymentIds}::text[],
        ${basePositions}::text[],
        ${undeployedAt}::timestamp[],
        ${basePositionRejects}::boolean[]
      ) AS incoming("deployment_id", "base_position", "undeployed_at", "base_position_rejects")
      ON CONFLICT ("world_id", "deployment_id") DO UPDATE
      SET "base_position" = CASE
            WHEN EXCLUDED."undeployed_at" >= ${table(this)}."undeployed_at"
            THEN EXCLUDED."base_position"
            ELSE ${table(this)}."base_position"
          END,
          "base_position_rejects" = CASE
            WHEN EXCLUDED."undeployed_at" >= ${table(this)}."undeployed_at"
            THEN EXCLUDED."base_position_rejects"
            ELSE ${table(this)}."base_position_rejects"
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
   *
   * The base match is skipped for rows recorded while a replacement already served that base: they
   * exist to tombstone the removed deployment by identity, and matching their base would reject the
   * replacement instead.
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
        AND (
          "deployment_id" = ${deploymentId}
          OR ("base_position" = ${basePosition} AND "base_position_rejects" IS TRUE)
        )
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
