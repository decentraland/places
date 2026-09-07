import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

export const shorthands: ColumnDefinitions | undefined = undefined

// A destination that must stay browsable while the automated discovery score leaves it alone.
// Kept apart from `highlighted`, `hidden` and `disabled` on purpose: featuring changes where a
// destination shows, hiding removes it from browse, and disabling takes it out of the catalogue
// altogether. None of those express "list it normally, just do not rank it", which is what a
// one-off like an internal event world needs.
const COLUMN = {
  exclude_from_ranking: {
    type: "boolean",
    default: false,
    notNull: true,
  },
}

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn("places", COLUMN)
  pgm.addColumn("worlds", COLUMN)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn("places", "exclude_from_ranking")
  pgm.dropColumn("worlds", "exclude_from_ranking")
}
