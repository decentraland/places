import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import WorldSceneUndeploymentModel from "../entities/WorldSceneUndeployment/model"
import WorldUndeploymentModel from "../entities/WorldUndeployment/model"

export const shorthands: ColumnDefinitions | undefined = undefined

// Note: Type.TimeStampTZ is TIMESTAMP WITHOUT TIME ZONE, matching places.deployed_at,
// which these watermarks are compared against.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(WorldUndeploymentModel.tableName, {
    world_id: {
      type: Type.Text,
      notNull: true,
      primaryKey: true,
    },
    undeployed_at: {
      type: Type.TimeStampTZ,
      notNull: true,
    },
  })

  pgm.createTable(WorldSceneUndeploymentModel.tableName, {
    world_id: {
      type: Type.Text,
      notNull: true,
    },
    deployment_id: {
      type: Type.Text,
      notNull: true,
    },
    base_position: {
      type: Type.Text,
      notNull: true,
    },
    undeployed_at: {
      type: Type.TimeStampTZ,
      notNull: true,
    },
  })

  pgm.addConstraint(
    WorldSceneUndeploymentModel.tableName,
    "world_scene_undeployments_pkey",
    { primaryKey: ["world_id", "deployment_id"] }
  )

  pgm.createIndex(
    WorldSceneUndeploymentModel.tableName,
    ["world_id", "base_position"],
    { name: "world_scene_undeployments_world_base_idx" }
  )
}

class IrreversibleUndeploymentWatermarksMigrationError extends Error {
  constructor() {
    super(
      "The undeployment watermark migration is irreversible because dropping its tables would allow retired deployments to be replayed."
    )
    this.name = "IrreversibleUndeploymentWatermarksMigrationError"
  }
}

export async function down(): Promise<void> {
  throw new IrreversibleUndeploymentWatermarksMigrationError()
}
