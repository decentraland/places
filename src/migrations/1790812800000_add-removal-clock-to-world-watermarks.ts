import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import WorldDeploymentPositionWatermarkModel from "../entities/WorldDeploymentPositionWatermark/model"
import WorldSceneUndeploymentModel from "../entities/WorldSceneUndeployment/model"

export const shorthands: ColumnDefinitions | undefined = undefined

// Removals are stamped by the worlds content server when it emits them, and a deployment's entity
// timestamp is set by the client when it signs, up to the deployment TTL earlier. Comparing the two
// rejected a scene signed before an undeployment and deployed after it. Removals move to their own
// `removed_at` column, compared against the deployment event's emission time; `undeployed_at` and
// `superseded_at` keep the entity timestamps of replacing deployments.
//
// Existing rows cannot say which clock stamped them. Inclusive position watermarks were only ever
// written by undeployments, so they move wholesale. Scene tombstones move too: most came from
// undeployment events, and those written on replacement are also covered by the replacing
// deployment's position watermark, which stays on the entity clock.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn(WorldSceneUndeploymentModel.tableName, {
    removed_at: { type: Type.TimeStampTZ, notNull: false },
  })
  pgm.alterColumn(WorldSceneUndeploymentModel.tableName, "undeployed_at", {
    notNull: false,
  })
  pgm.sql(`
    UPDATE ${WorldSceneUndeploymentModel.tableName}
    SET "removed_at" = "undeployed_at", "undeployed_at" = NULL
  `)

  pgm.addColumn(WorldDeploymentPositionWatermarkModel.tableName, {
    removed_at: { type: Type.TimeStampTZ, notNull: false },
  })
  pgm.alterColumn(
    WorldDeploymentPositionWatermarkModel.tableName,
    "superseded_at",
    { notNull: false }
  )
  pgm.sql(`
    UPDATE ${WorldDeploymentPositionWatermarkModel.tableName}
    SET "removed_at" = "superseded_at", "superseded_at" = NULL, "inclusive" = FALSE
    WHERE "inclusive" IS TRUE
  `)
}

class IrreversibleRemovalClockMigrationError extends Error {
  constructor() {
    super(
      "The removal clock migration is irreversible because folding removals back into the entity-timestamp columns would again reject deployments signed before a removal and deployed after it."
    )
    this.name = "IrreversibleRemovalClockMigrationError"
  }
}

export async function down(): Promise<void> {
  throw new IrreversibleRemovalClockMigrationError()
}
