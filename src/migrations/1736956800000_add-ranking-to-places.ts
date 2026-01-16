import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn("places", {
    ranking: {
      type: "float",
      notNull: false,
      default: 0,
    },
  })

  // Add index for ranking sorting/filtering
  pgm.createIndex("places", "ranking", {
    name: "places_ranking_idx",
    where: "disabled is false",
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex("places", "ranking", { name: "places_ranking_idx" })
  pgm.dropColumn("places", "ranking")
}

