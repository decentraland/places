import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import WorldDeploymentPositionWatermarkModel from "../entities/WorldDeploymentPositionWatermark/model"

export const shorthands: ColumnDefinitions | undefined = undefined

// Type.TimeStampTZ is TIMESTAMP WITHOUT TIME ZONE, matching places.deployed_at.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(WorldDeploymentPositionWatermarkModel.tableName, {
    world_id: {
      type: Type.Text,
      notNull: true,
    },
    position: {
      type: Type.Text,
      notNull: true,
    },
    superseded_at: {
      type: Type.TimeStampTZ,
      notNull: true,
    },
  })

  pgm.addConstraint(
    WorldDeploymentPositionWatermarkModel.tableName,
    "world_deployment_position_watermarks_pkey",
    { primaryKey: ["world_id", "position"] }
  )
}

class IrreversibleDeploymentPositionWatermarksMigrationError extends Error {
  constructor() {
    super(
      "The deployment position watermark migration is irreversible because dropping its table would allow retired deployments to be replayed."
    )
    this.name = "IrreversibleDeploymentPositionWatermarksMigrationError"
  }
}

export async function down(): Promise<void> {
  throw new IrreversibleDeploymentPositionWatermarksMigrationError()
}
