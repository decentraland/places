import { MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.alterColumn(PlaceModel.tableName, "like_rate", { default: 0 })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.alterColumn(PlaceModel.tableName, "like_rate", { default: 0.5 })
}
