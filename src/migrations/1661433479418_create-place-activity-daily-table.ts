import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
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

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("place_activity_daily", { cascade: true })
}
