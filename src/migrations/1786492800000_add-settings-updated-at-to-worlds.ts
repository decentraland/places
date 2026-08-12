import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import WorldModel from "../entities/World/model"

export const shorthands: ColumnDefinitions | undefined = undefined

// Raw "timestamptz" on purpose: gatsby's Type.TimeStampTZ is WITHOUT time zone, and this column
// stores worlds-content-server commit instants that are compared for ordering.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn(WorldModel.tableName, {
    settings_updated_at: {
      type: "timestamptz",
    },
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn(WorldModel.tableName, "settings_updated_at")
}
