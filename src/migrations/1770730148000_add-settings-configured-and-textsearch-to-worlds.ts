import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn("worlds", {
    settings_configured: {
      type: "boolean",
      default: false,
      notNull: true,
    },
    textsearch: {
      type: "tsvector",
      notNull: false,
    },
  })

  pgm.createIndex("worlds", "textsearch", {
    name: "worlds_textsearch_idx",
    method: "gin",
  })

  // Step 1: Mark worlds as settings_configured = true EXCEPT those with exactly
  // one associated place. Single-place worlds were most likely auto-created by
  // a deployment, so they stay unconfigured and get refreshed in step 2.
  pgm.sql(`
    UPDATE worlds w SET settings_configured = true
    WHERE (SELECT count(*) FROM places p WHERE p.world_id = w.id AND p.disabled IS FALSE) != 1
  `)

  // Step 2: For unconfigured single-scene worlds, refresh data from the last deployed place.
  // Multi-scene worlds were already marked configured in step 1 and are left untouched.
  pgm.sql(`
    UPDATE worlds w SET
      title = lp.title,
      description = lp.description,
      image = lp.image,
      content_rating = lp.content_rating,
      categories = lp.categories,
      updated_at = now()
    FROM (
      SELECT DISTINCT ON (p.world_id)
        p.world_id, p.title, p.description, p.image, p.content_rating, p.categories
      FROM places p
      WHERE p.disabled IS FALSE
      ORDER BY p.world_id, p.deployed_at DESC
    ) lp
    WHERE lp.world_id = w.id
      AND w.settings_configured = false
  `)

  // Step 3: Backfill textsearch for ALL worlds.
  // Runs after step 2 so single-scene worlds get textsearch from their refreshed data.
  pgm.sql(`
    UPDATE worlds SET textsearch = (
      setweight(to_tsvector(coalesce(title, '')), 'A') ||
      setweight(to_tsvector(coalesce(world_name, '')), 'A') ||
      setweight(to_tsvector(coalesce(description, '')), 'B') ||
      setweight(to_tsvector(coalesce(owner, '')), 'C')
    )
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex("worlds", "textsearch", { name: "worlds_textsearch_idx" })
  pgm.dropColumn("worlds", ["settings_configured", "textsearch"])
}
