import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

export const shorthands: ColumnDefinitions | undefined = undefined

// A world scene's identity is a row that is either enabled or opted out — the same
// predicate `findActiveByWorldIdAndPositions` / the world `updatePlace` use to resolve
// "same scene". An undeployed / overwritten / moderated row is NOT an identity. The
// guard below must use exactly this predicate so it lines up with the application.
const IDENTITY_PREDICATE = `
  world IS TRUE
  AND world_id IS NOT NULL
  AND base_position IS NOT NULL
  AND (disabled IS FALSE OR disabled_reason = 'opt_out')
`

// Canonical row for a (world_id, base_position): the one the rest of the system already
// treats as primary. It mirrors the /api/places ordering (`like_score DESC NULLS LAST,
// deployed_at DESC`) that world-storage-service resolves as `data[0]` when keying env vars,
// preferring an enabled row over an opted-out one, with id as a deterministic final tiebreak.
// Keeping this row (rather than blindly the newest) avoids stranding the id external data and
// interactions are attached to.
const CANONICAL_ORDER = `
  (disabled IS FALSE) DESC,
  like_score DESC NULLS LAST,
  deployed_at DESC,
  id DESC
`

export async function up(pgm: MigrationBuilder): Promise<void> {
  // An unguarded check-then-insert (plus SQS at-least-once delivery) could leave two
  // identity rows for the same world scene, each with a different id. From then on every
  // deploy sees 2 overlaps and mints yet another id, orphaning anything keyed on the
  // previous id (e.g. env vars in world-storage-service).

  // Report every duplicate set and the id that will be retained, so the retained ids can be
  // verified and any external references (env vars, etc.) reconciled from the migration log.
  pgm.sql(`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN
        SELECT world_id,
               base_position,
               (ARRAY_AGG(id ORDER BY ${CANONICAL_ORDER}))[1] AS keep_id,
               COUNT(*) AS total
        FROM places
        WHERE ${IDENTITY_PREDICATE}
        GROUP BY world_id, base_position
        HAVING COUNT(*) > 1
      LOOP
        RAISE NOTICE 'guard-active-world-place-uniqueness: world_id=% base_position=% keeping id=% disabling % duplicate(s)',
          r.world_id, r.base_position, r.keep_id, r.total - 1;
      END LOOP;
    END $$;
  `)

  // Deduplicate: keep the canonical identity row per (world_id, base_position) and disable
  // the rest. Required before the unique index below can be created.
  pgm.sql(`
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY world_id, base_position
               ORDER BY ${CANONICAL_ORDER}
             ) AS rn
      FROM places
      WHERE ${IDENTITY_PREDICATE}
    )
    UPDATE places p
    SET "disabled" = TRUE,
        "disabled_at" = now(),
        "updated_at" = now(),
        "disabled_reason" = 'overwritten'
    FROM ranked r
    WHERE p.id = r.id
      AND r.rn > 1
  `)

  // Structurally forbid two identity rows for the same world scene. The predicate matches
  // the application's active-identity predicate (enabled OR opt_out), so the check-then-insert
  // race is impossible: the losing concurrent insert fails instead of creating a divergent id.
  pgm.createIndex("places", ["world_id", "base_position"], {
    name: "places_active_world_scene_uniq",
    unique: true,
    where:
      "world IS TRUE AND world_id IS NOT NULL AND base_position IS NOT NULL AND (disabled IS FALSE OR disabled_reason = 'opt_out')",
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Only the index is reversible; rows disabled by the dedup step above are left as-is
  // (re-enabling them would recreate the duplicates this migration removed).
  pgm.dropIndex("places", ["world_id", "base_position"], {
    name: "places_active_world_scene_uniq",
  })
}
