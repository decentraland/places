import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.renameColumn(PlaceModel.tableName, "popularity_score", "highest_rated")
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.renameColumn(PlaceModel.tableName, "highest_rated", "popularity_score")
}
