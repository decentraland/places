import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn(PlaceModel.tableName, {
    deployment_id: {
      type: Type.Text,
    },
  })

  pgm.createIndex(PlaceModel.tableName, "deployment_id", {
    name: "places_deployment_id_idx",
    where: "deployment_id IS NOT NULL",
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex(PlaceModel.tableName, "deployment_id", {
    name: "places_deployment_id_idx",
  })
  pgm.dropColumn(PlaceModel.tableName, "deployment_id")
}
