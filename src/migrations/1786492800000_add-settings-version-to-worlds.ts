import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import WorldModel from "../entities/World/model"

// Mirrors worlds-content-server's worlds.settings_version. It is a monotonic per-world counter
// rather than a timestamp because that server writes updated_at from two different clocks, so a
// timestamp can move backwards while the settings move forward.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn(WorldModel.tableName, {
    settings_version: {
      type: "bigint",
    },
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn(WorldModel.tableName, "settings_version")
}

export const shorthands: ColumnDefinitions | undefined = undefined
