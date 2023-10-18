import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("deployment_tracks", {
    id: {
      type: Type.TransactionHash,
      primaryKey: true,
    },
    base_url: {
      type: Type.Text,
      notNull: true,
    },
    owner: {
      type: Type.TransactionHash,
      notNull: true,
    },
    from: {
      type: Type.BigInt,
      default: 0,
      notNull: true,
    },
    limit: {
      type: Type.SmallInt,
      default: 0,
      notNull: true,
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
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("deployment_tracks", { cascade: true })
}
