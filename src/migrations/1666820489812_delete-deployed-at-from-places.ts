import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns(PlaceModel.tableName, ["deployed_at"])
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn(PlaceModel.tableName, {
    deployed_at: {
      type: Type.TimeStampTZ,
      default: "now()",
      notNull: true,
    },
  })
}
