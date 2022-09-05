/* eslint-disable @typescript-eslint/naming-convention */
import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(PlaceModel.tableName, {
    id: {
      type: Type.UUID,
      primaryKey: true,
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
    owner: {
      type: Type.Address,
    },
    tags: {
      type: Type.Array(Type.Varchar(25)),
      default: "{}",
      notNull: true,
    },
    positions: {
      type: Type.Array(Type.Varchar(15)),
      default: "{}",
      notNull: true,
    },
    base_position: {
      type: Type.Varchar(15),
      notNull: true,
    },
    contact_name: {
      type: Type.Text,
    },
    contact_email: {
      type: Type.Text,
    },
    content_rating: {
      type: Type.Text,
    },
    deployed_at: {
      type: Type.TimeStampTZ,
      default: "now()",
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

  pgm.createIndex(PlaceModel.tableName, ["disabled", "positions"])
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(PlaceModel.tableName, { cascade: true })
}
