/* eslint-disable @typescript-eslint/naming-convention */
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.alterColumn(PlaceModel.tableName, "like_score", {
    notNull: false,
    default: null,
  })

  pgm.createIndex(PlaceModel.tableName, ["like_score", "deployed_at"], {
    where: "disabled is false",
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.alterColumn(PlaceModel.tableName, "like_score", {
    notNull: true,
    default: 0,
  })

  pgm.dropIndex(PlaceModel.tableName, ["like_score", "deployed_at"])
}
