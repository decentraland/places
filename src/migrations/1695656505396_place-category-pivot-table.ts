/* eslint-disable @typescript-eslint/naming-convention */
import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import CategoryModel from "../entities/Category/model"
import PlaceModel from "../entities/Place/model"
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

  pgm.addConstraint(PlaceCategories.tableName, "place_id_fk", {
    foreignKeys: {
      columns: "place_id",
      references: `${PlaceModel.tableName}(id)`,
    },
  })

  pgm.addConstraint(PlaceCategories.tableName, "category_id_fk", {
    foreignKeys: {
      columns: "category_id",
      references: `${CategoryModel.tableName}(name)`,
    },
  })

  pgm.createIndex(PlaceCategories.tableName, ["place_id", "category_id"])
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(PlaceCategories.tableName)
}
