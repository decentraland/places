/* eslint-disable @typescript-eslint/naming-convention */
import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
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
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("place_activities", { cascade: true })
}
