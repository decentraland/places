import { MigrationBuilder } from "node-pg-migrate"

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createIndex("places", "LOWER(world_name)", {
    name: "places_world_name_lower_idx",
    where: "world is true",
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex("places", "places_world_name_lower_idx")
}
