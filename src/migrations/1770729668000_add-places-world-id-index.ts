import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create index to optimize queries that fetch the latest place for a world
  // Used by world queries to get image, contact_name, and deployed_at from places
  pgm.createIndex(
    "places",
    ["world_id", { name: "deployed_at", sort: "DESC" }],
    {
      name: "places_world_id_deployed_at_idx",
      where: "disabled IS FALSE AND world_id IS NOT NULL",
    }
  )
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex("places", ["world_id", "deployed_at"], {
    name: "places_world_id_deployed_at_idx",
  })
}
