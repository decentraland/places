import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"

export const shorthands: ColumnDefinitions = {
  hidden: {
    type: Type.Boolean,
    default: false,
    notNull: true,
  },
}

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn(PlaceModel.tableName, shorthands)

  pgm.dropIndex(PlaceModel.tableName, ["world_name"])
  pgm.dropIndex(PlaceModel.tableName, ["base_position"])
  pgm.dropIndex(PlaceModel.tableName, ["updated_at"])
  pgm.dropIndex(PlaceModel.tableName, ["like_rate"])

  pgm.createIndex(PlaceModel.tableName, ["hidden", "world_name"], {
    where: "disabled is false and world is true",
  })
  pgm.createIndex(PlaceModel.tableName, ["hidden", "base_position"], {
    where: "disabled is false and world is false",
  })
  pgm.createIndex(PlaceModel.tableName, ["updated_at"], {
    where: "disabled is false and hidden is false and world is false",
  })
  pgm.createIndex(PlaceModel.tableName, ["like_rate"], {
    where: "disabled is false and hidden is false and world is false",
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex(PlaceModel.tableName, ["hidden", "world_name"])
  pgm.dropIndex(PlaceModel.tableName, ["hidden", "base_position"])
  pgm.dropIndex(PlaceModel.tableName, ["updated_at"])
  pgm.dropIndex(PlaceModel.tableName, ["like_rate"])

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

  pgm.dropColumn(PlaceModel.tableName, shorthands)
}
