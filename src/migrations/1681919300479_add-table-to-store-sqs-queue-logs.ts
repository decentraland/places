import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import CheckScenesModel from "../entities/CheckScenes/model"

export const shorthands: ColumnDefinitions = {
  id: {
    type: Type.Serial,
    primaryKey: true,
  },
  entity_id: {
    type: Type.Varchar(100),
    notNull: false,
  },
  content_server_url: {
    type: Type.Text,
    notNull: false,
  },
  base_position: {
    type: Type.Varchar(15),
    notNull: false,
  },
  positions: {
    type: Type.Array(Type.Varchar(15)),
    default: "{}",
    notNull: true,
  },
  action: {
    type: Type.Varchar(10),
    notNull: true,
  },
  deploy_at: {
    type: Type.TimeStampTZ,
  },
}

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(CheckScenesModel.tableName, shorthands)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(CheckScenesModel.tableName)
}
