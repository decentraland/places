import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

export const shorthands: ColumnDefinitions | undefined = undefined

/**
 * Worlds are never disabled — only places can be disabled (when replaced by
 * newer deployments). Remove the disabled and disabled_at columns from the
 * worlds table and recreate the partial indexes without the disabled condition.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // Drop the indexes that reference the disabled column
  pgm.dropIndex("worlds", "like_score", { name: "worlds_like_score_idx" })
  pgm.dropIndex("worlds", ["disabled", "show_in_places"], {
    name: "worlds_enabled_visible_idx",
  })

  // Drop the columns
  pgm.dropColumn("worlds", "disabled")
  pgm.dropColumn("worlds", "disabled_at")

  // Recreate indexes without the disabled condition
  pgm.createIndex("worlds", "show_in_places", {
    name: "worlds_visible_idx",
    where: "show_in_places IS TRUE",
  })

  pgm.createIndex("worlds", "like_score", {
    name: "worlds_like_score_idx",
    where: "show_in_places IS TRUE",
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop the new indexes
  pgm.dropIndex("worlds", "like_score", { name: "worlds_like_score_idx" })
  pgm.dropIndex("worlds", "show_in_places", { name: "worlds_visible_idx" })

  // Re-add the columns
  pgm.addColumn("worlds", {
    disabled: {
      type: Type.Boolean,
      default: false,
      notNull: true,
    },
    disabled_at: {
      type: Type.TimeStampTZ,
    },
  })

  // Recreate original indexes
  pgm.createIndex("worlds", ["disabled", "show_in_places"], {
    name: "worlds_enabled_visible_idx",
    where: "disabled IS FALSE AND show_in_places IS TRUE",
  })

  pgm.createIndex("worlds", "like_score", {
    name: "worlds_like_score_idx",
    where: "disabled IS FALSE AND show_in_places IS TRUE",
  })
}
