import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"

export const shorthands: ColumnDefinitions = {
  featured: {
    type: Type.Boolean,
    default: false,
    notNull: true,
  },
  featured_image: {
    type: Type.Text,
    notNull: false,
    default: null,
  },
}

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.renameColumn(PlaceModel.tableName, "featured", "highlighted")
  pgm.renameColumn(PlaceModel.tableName, "featured_image", "highlighted_image")
  pgm.addColumn(PlaceModel.tableName, shorthands)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn(PlaceModel.tableName, shorthands)
  pgm.renameColumn(PlaceModel.tableName, "highlighted", "featured")
  pgm.renameColumn(PlaceModel.tableName, "highlighted_image", "featured_image")
}
