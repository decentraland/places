import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"

export const shorthands: ColumnDefinitions = {
  activity: {
    type: Type.BigInt,
    default: 0,
    notNull: true,
  },
  popularity: {
    type: Type.Real,
    default: 0.5,
    notNull: true,
  },
}

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns(PlaceModel.tableName, shorthands)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns(PlaceModel.tableName, Object.keys(shorthands))
}
