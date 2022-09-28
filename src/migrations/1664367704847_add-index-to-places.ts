/* eslint-disable @typescript-eslint/naming-convention */
import { MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addIndex(PlaceModel.tableName, ["disabled", "updated_at"])
  pgm.addIndex(PlaceModel.tableName, ["disabled", "popularity_score"])
  pgm.addIndex(PlaceModel.tableName, ["disabled", "activity_score"])
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex(PlaceModel.tableName, ["disabled", "updated_at"])
  pgm.dropIndex(PlaceModel.tableName, ["disabled", "popularity_score"])
  pgm.dropIndex(PlaceModel.tableName, ["disabled", "activity_score"])
}
