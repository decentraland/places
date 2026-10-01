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
   * Tombstone scenes a deployment replaced, stamped with the replacing deployment's entity
   * timestamp. Everything it superseded at those bases is strictly older on that clock, so the base
   * may reject.
   */
  static async recordReplacements(
    worldId: string,
    scenes: UndeployedScene[],
    replacedAt: Date
  ): Promise<void> {
    await this.recordTombstones(
      worldId,
      scenes.map((scene) => ({ ...scene, basePositionRejects: true })),
      "undeployed_at",
      replacedAt
    )
  }

  /**
   * Tombstone scenes a removal event named, stamped with the moment the worlds content server
   * emitted it. Rejection compares this against the emission time of an incoming deployment, which
   * the same server stamps after committing it, so a scene signed before the removal and deployed
   * after it is not mistaken for what the removal retired.
   *
   * Each scene states whether its base parcel may reject: false when a replacement already served
   * that base, which keeps the row an identity-only tombstone.
   */
  static async recordRemovals(
    worldId: string,
    scenes: Array<UndeployedScene & { basePositionRejects: boolean }>,
    removedAt: Date
  ): Promise<void> {
    await this.recordTombstones(worldId, scenes, "removed_at", removedAt)
  }

  /**
   * A deployment id is a content hash over the scene metadata the base parcel is derived from, so
   * repeat events for one scene carry the same base. The base is still only taken from a stamp at
   * least as new as the stored one on the same clock, so a delayed event can never pair its own
   * base with a newer timestamp. Base rejection, once armed, stays armed.
   */
  private static async recordTombstones(
    worldId: string,
    scenes: Array<UndeployedScene & { basePositionRejects: boolean }>,
    clock: "undeployed_at" | "removed_at",
    stampedAt: Date
  ): Promise<void> {
    if (scenes.length === 0) {
      return
    }

    const uniqueScenes = [
      ...new Map(scenes.map((scene) => [scene.entityId, scene])).values(),
    ]
    const deploymentIds = uniqueScenes.map((scene) => scene.entityId)
    const basePositions = uniqueScenes.map((scene) => scene.baseParcel)
    const basePositionRejects = uniqueScenes.map(
      (scene) => scene.basePositionRejects
    )
    const tombstones = table(this)
    const column = SQL.raw(`"${clock}"`)

    const sql = SQL`
      INSERT INTO ${tombstones} ("world_id", "deployment_id", "base_position", "base_position_rejects", ${column})
      SELECT ${worldId.toLowerCase()}, incoming."deployment_id", incoming."base_position", incoming."base_position_rejects", ${stampedAt}::timestamp
      FROM unnest(
        ${deploymentIds}::text[],
        ${basePositions}::text[],
        ${basePositionRejects}::boolean[]
      ) AS incoming("deployment_id", "base_position", "base_position_rejects")
      ON CONFLICT ("world_id", "deployment_id") DO UPDATE
      SET "base_position" = CASE
            WHEN ${tombstones}.${column} IS NULL OR EXCLUDED.${column} >= ${tombstones}.${column}
            THEN EXCLUDED."base_position"
            ELSE ${tombstones}."base_position"
          END,
          "base_position_rejects" = ${tombstones}."base_position_rejects" OR EXCLUDED."base_position_rejects",
          ${column} = GREATEST(${tombstones}.${column}, EXCLUDED.${column})
    `

    await this.namedQuery(`record_scene_tombstones_${clock}`, sql)
  }

  /**
   * Find the tombstone that supersedes an incoming deployment, so neither a removed deployment nor
   * an older revision at its base can be recreated.
   *
   * Each stamp is compared on its own clock: a replacement against the deployment's entity
   * timestamp, a removal against the moment the deployment was emitted. The identity match also
   * takes either stamp against the entity timestamp, since every writer stamps at or after the
   * removed deployment's own entity timestamp; rows migrated from before the removal clock carry
   * entity timestamps in `removed_at`.
   *
   * The base match is skipped for rows recorded while a replacement already served that base: they
   * exist to tombstone the removed deployment by identity, and matching their base would reject the
   * replacement instead.
   */
  static async findSupersedingUndeployment(
    worldId: string,
    deploymentId: string,
    basePosition: string,
    deployedAt: Date,
    emittedAt: Date
  ): Promise<WorldSceneUndeploymentAttributes | null> {
    const sql = SQL`
      SELECT * FROM ${table(this)}
      WHERE "world_id" = ${worldId.toLowerCase()}
        AND (
          (
            "deployment_id" = ${deploymentId}
            AND (
              "removed_at" >= ${emittedAt}
              OR GREATEST("undeployed_at", "removed_at") >= ${deployedAt}
            )
          )
          OR (
            "base_position" = ${basePosition}
            AND "base_position_rejects" IS TRUE
            AND ("undeployed_at" >= ${deployedAt} OR "removed_at" >= ${emittedAt})
          )
        )
      LIMIT 1
    `

    const results = await this.namedQuery<WorldSceneUndeploymentAttributes>(
      "find_superseding_undeployment",
      sql
    )
    return results[0] || null
  }
}
