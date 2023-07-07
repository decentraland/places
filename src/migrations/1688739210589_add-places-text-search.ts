import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns(PlaceModel.tableName, {
    textsearch: {
      type: "tsvector",
      default: "",
    },
  })

  pgm.sql(`
    UPDATE "${PlaceModel.tableName}"
    SET "textsearch" = (
      setweight(to_tsvector("title"), 'A') ||
      setweight(to_tsvector("description"), 'B') || 
      setweight(to_tsvector("owner"), 'C') || 
      setweight(to_tsvector(concat("tags")), 'D')
    )`)

  pgm.createIndex(PlaceModel.tableName, ["textsearch"], { method: "gin" })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns(PlaceModel.tableName, ["textsearch"])
}
