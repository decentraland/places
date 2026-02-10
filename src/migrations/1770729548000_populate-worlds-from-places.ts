import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create worlds from existing places where world=true
  // For each unique world_name, create a world record extracting data from the place
  // Note: id is the lowercased world_name for predictable/deterministic IDs
  pgm.sql(`
    INSERT INTO worlds (
      id,
      world_name,
      title,
      description,
      image,
      content_rating,
      categories,
      owner,
      likes,
      dislikes,
      favorites,
      like_rate,
      like_score,
      disabled,
      disabled_at,
      created_at,
      updated_at
    )
    SELECT DISTINCT ON (LOWER(world_name))
      LOWER(world_name) as id,
      world_name,
      title,
      description,
      image,
      COALESCE(content_rating, 'RP') as content_rating,
      categories,
      owner,
      likes,
      dislikes,
      favorites,
      like_rate,
      like_score,
      disabled,
      disabled_at,
      created_at,
      updated_at
    FROM places
    WHERE world = true AND world_name IS NOT NULL
    ORDER BY LOWER(world_name), updated_at DESC
  `)

  // Update places to link to their corresponding world record
  // world_id is now the lowercased world_name
  pgm.sql(`
    UPDATE places p
    SET world_id = w.id
    FROM worlds w
    WHERE p.world = true
      AND p.world_name IS NOT NULL
      AND LOWER(p.world_name) = w.id
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Unlink places from worlds
  pgm.sql(`
    UPDATE places
    SET world_id = NULL
    WHERE world = true
  `)

  // Delete all worlds created from places
  pgm.sql(`DELETE FROM worlds`)
}
