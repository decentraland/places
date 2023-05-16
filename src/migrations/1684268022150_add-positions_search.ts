import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("places_positions", {
    place_id: {
      type: Type.UUID,
      primaryKey: true,
    },
    positions: {
      type: Type.Array(Type.Varchar(15)),
      default: "{}",
      notNull: true,
    },
  })

  pgm.sql(`
      INSERT INTO places_positions (place_id, positions)
      SELECT id, positions FROM places
    `)
  pgm.createIndex("places_positions", ["place_id", "positions"])
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex("places_positions", ["place_id", "positions"])
  pgm.dropTable("places_positions")
}

/* import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns(PlaceModel.tableName, {
    positions_search: {
      type: Type.Text,
    },
  })

  pgm.sql(`
      UPDATE ${PlaceModel.tableName} SET
      positions_search=CONCAT(';',array_to_string(positions, ';'),';')
    `)
  pgm.createIndex(PlaceModel.tableName, [
    "disabled",
    "world",
    "positions_search",
    "like_rate",
  ])
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex(PlaceModel.tableName, [
    "disabled",
    "world",
    "positions_search",
    "like_rate",
  ])
  pgm.dropColumn(PlaceModel.tableName, "positions_search")
}
 */
