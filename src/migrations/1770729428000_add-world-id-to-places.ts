import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn(PlaceModel.tableName, {
    world_id: {
      type: Type.Text,
      references: "worlds(id)",
      onDelete: "SET NULL",
    },
  })

  // Index for looking up places by world_id
  pgm.createIndex(PlaceModel.tableName, "world_id", {
    name: "places_world_id_idx",
    where: "world_id IS NOT NULL",
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex(PlaceModel.tableName, "world_id", {
    name: "places_world_id_idx",
  })
  pgm.dropColumn(PlaceModel.tableName, "world_id")
}
