import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import WorldSceneUndeploymentModel from "../entities/WorldSceneUndeployment/model"

export const shorthands: ColumnDefinitions | undefined = undefined

// A scene undeployment is rejected by its exact deployment id or by its base parcel, and those two
// need to be independent. When a replacement already serves the base the removal cleared, matching
// the base would reject the replacement, but the removed deployment still has to be tombstoned by
// identity so a delayed delivery of it cannot recreate a scene that is gone. Existing rows were all
// recorded with base rejection in force, so the column defaults to true.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn(WorldSceneUndeploymentModel.tableName, {
    base_position_rejects: {
      type: "boolean",
      notNull: true,
      default: true,
    },
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn(WorldSceneUndeploymentModel.tableName, "base_position_rejects")
}
