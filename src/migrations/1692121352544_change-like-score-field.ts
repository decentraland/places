/* eslint-disable @typescript-eslint/naming-convention */
import { Type } from "decentraland-gatsby/dist/entities/Database/types"
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

  pgm.dropColumn(PlaceModel.tableName, "like_rate")

  pgm.renameColumn(PlaceModel.tableName, "like_score", "like_rate")
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.renameColumn(PlaceModel.tableName, "like_rate", "like_score")

  pgm.addColumn(PlaceModel.tableName, {
    like_rate: {
      type: Type.Real,
      notNull: true,
      default: 0,
    },
  })

  pgm.createIndex(PlaceModel.tableName, ["like_rate"], {
    where: "disabled is false and world is false",
  })

  pgm.alterColumn(PlaceModel.tableName, "like_score", {
    notNull: true,
    default: 0,
  })

  pgm.dropIndex(PlaceModel.tableName, ["like_score", "deployed_at"])
}
