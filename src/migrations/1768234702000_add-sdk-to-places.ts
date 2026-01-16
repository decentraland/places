import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn("places", {
    sdk: {
      type: "varchar(50)",
      notNull: false,
      default: null,
    },
  })

  // Add index for SDK filtering
  pgm.createIndex("places", "sdk", {
    name: "places_sdk_idx",
    where: "disabled is false",
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex("places", "sdk", { name: "places_sdk_idx" })
  pgm.dropColumn("places", "sdk")
}
