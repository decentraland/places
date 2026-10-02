import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

export const shorthands: ColumnDefinitions | undefined = undefined

const VIEW_NAME = "place_scene_resolution"

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE VIEW ${VIEW_NAME} WITH (security_barrier = true) AS
    SELECT
      p.id AS place_id,
      TRUE AS world,
      lower(p.world_name) AS world_name,
      unnest(p.positions) AS position
    FROM places p
    WHERE p.world IS TRUE
      AND (p.disabled IS FALSE OR p.disabled_reason = 'opt_out')
    UNION ALL
    SELECT
      p.id AS place_id,
      FALSE AS world,
      NULL::text AS world_name,
      pp.position AS position
    FROM places p
    JOIN place_positions pp ON pp.base_position = p.base_position
    WHERE p.world IS FALSE
      AND p.disabled IS FALSE
  `)

  pgm.sql(`REVOKE ALL ON ${VIEW_NAME} FROM PUBLIC`)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP VIEW IF EXISTS ${VIEW_NAME}`)
}
