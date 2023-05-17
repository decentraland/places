/* eslint-disable @typescript-eslint/naming-convention */
import { MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.renameColumn(PlaceModel.tableName, "popularity", "popularity_score")
  pgm.renameColumn(PlaceModel.tableName, "activity", "activity_score")
  pgm.createIndex(PlaceModel.tableName, ["disabled", "updated_at"])
  pgm.createIndex(PlaceModel.tableName, ["disabled", "popularity_score"])
  pgm.createIndex(PlaceModel.tableName, ["disabled", "activity_score"])
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex(PlaceModel.tableName, ["disabled", "updated_at"])
  pgm.dropIndex(PlaceModel.tableName, ["disabled", "popularity_score"])
  pgm.dropIndex(PlaceModel.tableName, ["disabled", "activity_score"])
  pgm.renameColumn(PlaceModel.tableName, "popularity_score", "popularity")
  pgm.renameColumn(PlaceModel.tableName, "activity_score", "activity")
}
