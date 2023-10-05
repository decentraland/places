/* eslint-disable @typescript-eslint/naming-convention */
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import CategoryModel from "../entities/Category/model"
import PlaceModel from "../entities/Place/model"

export const shorthands: ColumnDefinitions | undefined = undefined

const INITIAL_CATEGORIES = [
  "poi",
  "featured",
  "gaming",
  "gambling",
  "social",
  "music",
  "art",
  "fashion",
  "crypto",
  "education",
  "commercial",
  "sport",
  "ads",
]

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn(PlaceModel.tableName, "categories")
  pgm.dropColumn(CategoryModel.tableName, "places_counter")

  for (const category of INITIAL_CATEGORIES) {
    pgm.sql(
      `INSERT INTO "${CategoryModel.tableName}" (name, active) VALUES ('${category}', TRUE)`
    )
  }
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn(PlaceModel.tableName, {
    categories: {
      type: "VARCHAR(50)[]",
      notNull: true,
      default: "{}",
    },
  })

  pgm.addColumn(CategoryModel.tableName, {
    places_counter: {
      type: "INTEGER",
      notNull: true,
      default: 0,
    },
  })

  pgm.sql(`TRUNCATE "${CategoryModel.tableName}"`)
}
