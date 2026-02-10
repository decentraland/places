import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Rename place_id to entity_id in user_favorites table
  pgm.renameColumn("user_favorites", "place_id", "entity_id")

  // Rename place_id to entity_id in user_likes table
  pgm.renameColumn("user_likes", "place_id", "entity_id")

  // Rename place_id to entity_id in content_ratings table
  pgm.renameColumn("content_ratings", "place_id", "entity_id")
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Revert: rename entity_id back to place_id in user_favorites table
  pgm.renameColumn("user_favorites", "entity_id", "place_id")

  // Revert: rename entity_id back to place_id in user_likes table
  pgm.renameColumn("user_likes", "entity_id", "place_id")

  // Revert: rename entity_id back to place_id in content_ratings table
  pgm.renameColumn("content_ratings", "entity_id", "place_id")
}
