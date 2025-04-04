import { MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex(PlaceModel.tableName, ["world_name"])
  pgm.createIndex("places", "LOWER(world_name)", {
    name: "places_world_name_lower_idx",
    where: "world is true",
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex("places", "places_world_name_lower_idx")

  pgm.createIndex(PlaceModel.tableName, ["world_name"], {
    where: "disabled is false and world is true",
  })
}
