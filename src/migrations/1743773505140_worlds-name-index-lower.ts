import { MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex(PlaceModel.tableName, ["world_name"])
  pgm.createIndex(PlaceModel.tableName, ["world_name"], {
    where: "world is true",
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex(PlaceModel.tableName, ["world_name"])
  pgm.createIndex(PlaceModel.tableName, ["world_name"], {
    where: "world is true",
  })
}
