import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"

export const shorthands: ColumnDefinitions = {
  world: {
    type: Type.Boolean,
    default: false,
    notNull: true,
  },
  world_name: {
    type: Type.Text,
    notNull: false,
    default: null,
  },
}

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn(PlaceModel.tableName, shorthands)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn(PlaceModel.tableName, shorthands)
}
