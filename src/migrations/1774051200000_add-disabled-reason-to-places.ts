import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn("places", {
    disabled_reason: {
      type: "varchar(20)",
      notNull: false,
      default: null,
    },
  })

  // Backfill existing disabled Genesis City places
  pgm.sql(`
    UPDATE places
    SET disabled_reason = 'overwritten'
    WHERE disabled IS TRUE AND world IS FALSE
  `)

  // Backfill existing disabled world places with opt_out as the safe default
  pgm.sql(`
    UPDATE places
    SET disabled_reason = 'opt_out'
    WHERE disabled IS TRUE AND world IS TRUE
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn("places", "disabled_reason")
}
