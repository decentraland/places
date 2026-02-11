import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Rename place_content_ratings table to content_ratings if it still has the old name.
  // On existing databases the table was created as "place_content_ratings";
  // on fresh databases the table is already "content_ratings" (model.tableName changed).
  pgm.sql(
    `ALTER TABLE IF EXISTS "place_content_ratings" RENAME TO "content_ratings"`
  )

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

  // Revert the table rename back to place_content_ratings
  pgm.sql(
    `ALTER TABLE IF EXISTS "content_ratings" RENAME TO "place_content_ratings"`
  )
}
