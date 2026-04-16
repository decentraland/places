import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

export const shorthands: ColumnDefinitions | undefined = undefined

/**
 * Normalize world names to lowercase across both the worlds and places tables,
 * and replace the case-sensitive UNIQUE constraint on worlds.world_name with
 * a case-insensitive unique index.
 *
 * This prevents duplicate world records caused by casing differences
 * (e.g., "lazaro.dcl.eth" vs "Lazaro.dcl.eth").
 *
 * See: https://github.com/decentraland/core-team/issues/145
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // 1. Normalize existing world_name values to lowercase in worlds table
  pgm.sql(
    `UPDATE worlds SET world_name = LOWER(world_name) WHERE world_name != LOWER(world_name)`
  )

  // 2. Normalize existing world_name values to lowercase in places table
  pgm.sql(
    `UPDATE places SET world_name = LOWER(world_name) WHERE world_name IS NOT NULL AND world_name != LOWER(world_name)`
  )

  // 3. Drop the existing case-sensitive unique constraint on worlds.world_name
  //    (created by the "unique: true" option in the create-worlds-table migration)
  pgm.sql(`ALTER TABLE worlds DROP CONSTRAINT IF EXISTS worlds_world_name_key`)

  // 4. Drop the existing case-sensitive index
  pgm.dropIndex("worlds", "world_name", {
    name: "worlds_world_name_idx",
    ifExists: true,
  })

  // 5. Create a case-insensitive unique index on worlds.world_name
  pgm.sql(
    `CREATE UNIQUE INDEX worlds_world_name_lower_unique_idx ON worlds (LOWER(world_name))`
  )

  // 6. Create a regular index for case-insensitive lookups
  pgm.sql(`CREATE INDEX worlds_world_name_idx ON worlds (LOWER(world_name))`)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop the case-insensitive indexes
  pgm.sql(`DROP INDEX IF EXISTS worlds_world_name_lower_unique_idx`)
  pgm.sql(`DROP INDEX IF EXISTS worlds_world_name_idx`)

  // Restore the original case-sensitive unique constraint
  pgm.sql(
    `ALTER TABLE worlds ADD CONSTRAINT worlds_world_name_key UNIQUE (world_name)`
  )

  // Restore the original case-sensitive index
  pgm.createIndex("worlds", "world_name", {
    name: "worlds_world_name_idx",
  })
}
