import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn("worlds", {
    highlighted: {
      type: "boolean",
      default: false,
      notNull: true,
    },
    highlighted_image: {
      type: "text",
      notNull: false,
      default: null,
    },
    ranking: {
      type: "float",
      notNull: false,
      default: 0,
    },
  })

  pgm.createIndex("worlds", "ranking", {
    name: "worlds_ranking_idx",
    where: "disabled IS FALSE AND show_in_places IS TRUE",
  })

  // Populate highlighted and highlighted_image from existing highlighted world places
  pgm.sql(`
    UPDATE worlds w
    SET highlighted = true,
        highlighted_image = sub.highlighted_image
    FROM (
      SELECT DISTINCT ON (world_id) world_id, highlighted_image
      FROM places
      WHERE world = true AND highlighted = true AND disabled = false
      ORDER BY world_id, deployed_at DESC
    ) sub
    WHERE w.id = sub.world_id
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex("worlds", "ranking", { name: "worlds_ranking_idx" })
  pgm.dropColumn("worlds", ["highlighted", "highlighted_image", "ranking"])
}
