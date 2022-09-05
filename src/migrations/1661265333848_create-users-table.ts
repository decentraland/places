/* eslint-disable @typescript-eslint/naming-convention */
import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"
import isEthereumAddress from "validator/lib/isEthereumAddress"

import UserModel from "../entities/User/model"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(UserModel.tableName, {
    user: {
      type: Type.Address,
      primaryKey: true,
    },
    permissions: {
      type: Type.Array(Type.Varchar(25)),
      default: "{}",
      notNull: true,
    },
    created_at: {
      type: Type.TimeStampTZ,
      default: "now()",
      notNull: true,
    },
    updated_at: {
      type: Type.TimeStampTZ,
      default: "now()",
      notNull: true,
    },
  })

  if (isEthereumAddress(process.env.BOOSTRAP_USER || "")) {
    pgm.sql(`
      INSERT INTO ${
        UserModel.tableName
      } ("user", "permissions", "created_at", "updated_at")
      VALUES ('${process.env.BOOSTRAP_USER!}', '{}', NOW(), NOW())
    `)
  }
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(UserModel.tableName, { cascade: true })
}
