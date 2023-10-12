/* eslint-disable @typescript-eslint/naming-convention */
import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
  UPDATE "${PlaceModel.tableName}"
  SET "textsearch" = (
    setweight(to_tsvector(coalesce("title", '')), 'A') ||
    setweight(to_tsvector(coalesce("description", '')), 'B') || 
    setweight(to_tsvector(coalesce("owner", '')), 'C')
  )`)

  pgm.dropColumn(PlaceModel.tableName, "tags")
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn(PlaceModel.tableName, {
    tags: {
      type: Type.Array(Type.Varchar(25)),
      default: "{}",
      notNull: true,
    },
  })

  pgm.sql(`
  UPDATE "${PlaceModel.tableName}"
  SET "textsearch" = (
    setweight(to_tsvector(coalesce("title", '')), 'A') ||
    setweight(to_tsvector(coalesce("description", '')), 'B') || 
    setweight(to_tsvector(coalesce("owner", '')), 'C') || 
    setweight(to_tsvector(coalesce(concat("tags"), '')), 'D')
  )`)
}
