import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"

export const shorthands: ColumnDefinitions = {
  deployed_at: {
    type: Type.TimeStampTZ,
    default: "now()",
    notNull: true,
  },
}

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn(PlaceModel.tableName, shorthands)
  pgm.dropColumn(PlaceModel.tableName, ["visible"])
  pgm.sql(`
      UPDATE ${PlaceModel.tableName} SET
      deployed_at=updated_at
    `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns(PlaceModel.tableName, Object.keys(shorthands))
  pgm.addColumn(PlaceModel.tableName, {
    visible: {
      type: Type.Boolean,
      default: true,
      notNull: true,
    },
  })
}
