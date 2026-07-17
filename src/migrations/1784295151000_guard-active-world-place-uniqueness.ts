import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  // A world scene is uniquely identified by its (world_id, base_position). The
  // deployment consumer resolves "same scene" by counting active overlapping
  // rows, and an unguarded check-then-insert (plus SQS at-least-once delivery)
  // could leave two ACTIVE rows for the same scene, each with a different id.
  // From then on every deploy sees 2 overlaps and mints yet another id, which
  // orphans anything keyed on the previous place id (e.g. env vars).
  //
  // Deduplicate before adding the unique index: for each (world_id, base_position)
  // keep the most recently deployed active row and disable the rest. Ties are
  // broken by id so the choice is deterministic.
  pgm.sql(`
    UPDATE places p
    SET "disabled" = TRUE,
        "disabled_at" = now(),
        "updated_at" = now(),
        "disabled_reason" = 'overwritten'
    WHERE p.world IS TRUE
      AND p.disabled IS FALSE
      AND p.world_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM places q
        WHERE q.world IS TRUE
          AND q.disabled IS FALSE
          AND q.world_id = p.world_id
          AND q.base_position = p.base_position
          AND (
            q.deployed_at > p.deployed_at
            OR (q.deployed_at = p.deployed_at AND q.id > p.id)
          )
      )
  `)

  // Structurally forbid two active rows for the same world scene. This makes the
  // check-then-insert race impossible: the losing concurrent insert fails instead
  // of silently creating a divergent id.
  pgm.createIndex("places", ["world_id", "base_position"], {
    name: "places_active_world_scene_uniq",
    unique: true,
    where: "world IS TRUE AND disabled IS FALSE AND world_id IS NOT NULL",
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Only the index is reversible; rows disabled by the dedup step above are left
  // as-is (re-enabling them would recreate the duplicates this migration removed).
  pgm.dropIndex("places", ["world_id", "base_position"], {
    name: "places_active_world_scene_uniq",
  })
}
