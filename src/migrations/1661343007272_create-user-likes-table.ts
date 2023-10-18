import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import UserLikesModel from "../entities/UserLikes/model"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(UserLikesModel.tableName, {
    place_id: {
      type: Type.UUID,
      primaryKey: true,
    },
    user: {
      type: Type.Address,
      primaryKey: true,
    },
    user_activity: {
      type: Type.Integer,
      default: 0,
      notNull: true,
    },
    like: {
      type: Type.Boolean,
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

  pgm.createIndex(UserLikesModel.tableName, [
    "place_id",
    "like",
    "user_activity",
  ])
  pgm.createIndex(UserLikesModel.tableName, ["user", "like", "user_activity"])
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(UserLikesModel.tableName, { cascade: false })
}
