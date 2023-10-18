import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import Model from "../entities/Category/model"
import PlaceModel from "../entities/Place/model"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(Model.tableName, {
    name: {
      primaryKey: true,
      type: "VARCHAR(50)",
      notNull: true,
    },
    active: {
      type: "BOOLEAN",
      notNull: true,
      default: false,
    },
    places_counter: {
      type: "INTEGER",
      notNull: true,
      default: 0,
    },
    created_at: {
      type: "TIMESTAMPTZ",
      notNull: true,
      default: "now()",
    },
    updated_at: {
      type: "TIMESTAMPTZ",
      notNull: true,
      default: "now()",
    },
  })

  pgm.createIndex(Model.tableName, ["active", "places_counter", "name"])

  pgm.addColumns(PlaceModel.tableName, {
    categories: {
      type: "VARCHAR(50)[]",
      notNull: true,
      default: "{}",
    },
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(Model.tableName)
  pgm.dropColumns(PlaceModel.tableName, ["categories"])
}
