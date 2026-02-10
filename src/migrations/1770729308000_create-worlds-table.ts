import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("worlds", {
    // id is the lowercased world name (e.g., "foo.dcl.eth")
    // This makes world IDs predictable and deterministic
    id: {
      type: Type.Text,
      primaryKey: true,
    },
    // world_name stores the original casing for display purposes
    // In practice, world names are typically lowercase, but we preserve
    // the original value in case casing becomes relevant in the future
    world_name: {
      type: Type.Text,
      notNull: true,
      unique: true,
    },
    title: {
      type: Type.Varchar(50),
    },
    description: {
      type: Type.Text,
    },
    image: {
      type: Type.Text,
    },
    content_rating: {
      type: Type.Text,
      default: "RP",
      notNull: true,
    },
    categories: {
      type: Type.Array(Type.Varchar(50)),
      default: "{}",
      notNull: true,
    },
    owner: {
      type: Type.Address,
    },
    show_in_places: {
      type: Type.Boolean,
      default: true,
      notNull: true,
    },
    single_player: {
      type: Type.Boolean,
      default: false,
      notNull: true,
    },
    skybox_time: {
      type: Type.Integer,
    },
    likes: {
      type: Type.Integer,
      default: 0,
      notNull: true,
    },
    dislikes: {
      type: Type.Integer,
      default: 0,
      notNull: true,
    },
    favorites: {
      type: Type.Integer,
      default: 0,
      notNull: true,
    },
    like_rate: {
      type: Type.Real,
      default: 0.5,
    },
    like_score: {
      type: Type.Real,
      default: 0,
    },
    disabled: {
      type: Type.Boolean,
      default: false,
      notNull: true,
    },
    disabled_at: {
      type: Type.TimeStampTZ,
    },
    created_at: {
      type: Type.TimeStampTZ,
      default: "now()",
      notNull: true,
    },
    updated_at: {
      type: Type.TimeStampTZ,
      default: "now()",
      notNull: true,
    },
  })

  // Index for world_name lookups (case-insensitive)
  pgm.createIndex("worlds", "world_name", {
    name: "worlds_world_name_idx",
  })

  // Index for listing enabled worlds
  pgm.createIndex("worlds", ["disabled", "show_in_places"], {
    name: "worlds_enabled_visible_idx",
    where: "disabled IS FALSE AND show_in_places IS TRUE",
  })

  // Index for like_score sorting
  pgm.createIndex("worlds", "like_score", {
    name: "worlds_like_score_idx",
    where: "disabled IS FALSE AND show_in_places IS TRUE",
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex("worlds", "like_score", { name: "worlds_like_score_idx" })
  pgm.dropIndex("worlds", ["disabled", "show_in_places"], {
    name: "worlds_enabled_visible_idx",
  })
  pgm.dropIndex("worlds", "world_name", { name: "worlds_world_name_idx" })
  pgm.dropTable("worlds", { cascade: true })
}
