import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.renameColumn(PlaceModel.tableName, "popularity_score", "like_rate")
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.renameColumn(PlaceModel.tableName, "like_rate", "popularity_score")
}
