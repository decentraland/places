import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns(PlaceModel.tableName, ["activity_score"])
  pgm.dropTable("place_activities", { cascade: true })
  pgm.dropTable("place_activity_daily", { cascade: true })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns(PlaceModel.tableName, {
    activity_score: {
      type: Type.BigInt,
      default: 0,
      notNull: true,
    },
  })
  pgm.createTable("place_activities", {
    place_id: {
      type: Type.UUID,
      primaryKey: true,
    },
    catalyst_id: {
      type: Type.TransactionHash,
      primaryKey: true,
    },
    created_at: {
      type: Type.TimeStampTZ,
      primaryKey: true,
    },
    users: {
      type: Type.Integer,
      notNull: true,
    },
  })

  pgm.createIndex("place_activities", ["place_id", "users"])

  pgm.createTable("place_activity_daily", {
    place_id: {
      type: Type.UUID,
      primaryKey: true,
    },
    users: {
      type: Type.Integer,
      notNull: true,
    },
    checks: {
      type: Type.Integer,
      notNull: true,
    },
    date: {
      type: Type.Date,
      primaryKey: true,
    },
  })

  pgm.createIndex("place_activity_daily", ["date"])
  pgm.createIndex("place_activity_daily", ["place_id", "date"])
}
