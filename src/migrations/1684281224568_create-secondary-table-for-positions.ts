/* eslint-disable @typescript-eslint/naming-convention */
import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"
import PlacePositionModel from "../entities/PlacePosition/model"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(PlacePositionModel.tableName, {
    position: {
      primaryKey: true,
      type: Type.Varchar(15),
      notNull: true,
    },
    base_position: {
      type: Type.Varchar(15),
      notNull: true,
    },
  })

  pgm.dropIndex(PlaceModel.tableName, ["disabled", "positions"])
  pgm.dropIndex(PlaceModel.tableName, ["disabled", "updated_at"])
  pgm.dropIndex(PlaceModel.tableName, ["disabled", "popularity_score"])

  pgm.createIndex(PlaceModel.tableName, ["world_name"], {
    where: "disabled is false and world is true",
  })
  pgm.createIndex(PlaceModel.tableName, ["base_position"], {
    where: "disabled is false and world is false",
  })
  pgm.createIndex(PlaceModel.tableName, ["updated_at"], {
    where: "disabled is false and world is false",
  })
  pgm.createIndex(PlaceModel.tableName, ["like_rate"], {
    where: "disabled is false and world is false",
  })
  pgm.createIndex(PlacePositionModel.tableName, ["position", "base_position"], {
    unique: true,
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex(PlaceModel.tableName, ["world_name"])
  pgm.dropIndex(PlaceModel.tableName, ["base_position"])
  pgm.dropIndex(PlaceModel.tableName, ["updated_at"])
  pgm.dropIndex(PlaceModel.tableName, ["like_rate"])

  pgm.createIndex(PlaceModel.tableName, ["disabled", "positions"])
  pgm.createIndex(PlaceModel.tableName, ["disabled", "updated_at"])
  pgm.createIndex(PlaceModel.tableName, ["disabled", "popularity_score"])

  pgm.dropTable(PlacePositionModel.tableName, { cascade: true })
}
