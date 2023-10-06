/* eslint-disable @typescript-eslint/naming-convention */
import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceCategories from "../entities/PlaceCategories/model"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(PlaceCategories.tableName, {
    place_id: {
      type: Type.UUID,
      notNull: true,
    },
    category_id: {
      type: Type.Varchar(50),
      notNull: true,
    },
  })

  pgm.createIndex(PlaceCategories.tableName, ["place_id", "category_id"])
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(PlaceCategories.tableName)
}
