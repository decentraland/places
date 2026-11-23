import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import env from "decentraland-gatsby/dist/utils/env"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import { normalizeContentServerUrl } from "../entities/CheckScenes/task/contentServerUrl"
import PlaceModel from "../entities/Place/model"
import WorldModel from "../entities/World/model"
import WorldDeploymentPositionWatermarkModel from "../entities/WorldDeploymentPositionWatermark/model"
import WorldSceneUndeploymentModel from "../entities/WorldSceneUndeployment/model"
import WorldUndeploymentModel from "../entities/WorldUndeployment/model"

export const shorthands: ColumnDefinitions | undefined = undefined

const WATERMARK_KEYS: Array<{ table: string; key: string[] }> = [
  { table: WorldUndeploymentModel.tableName, key: ["world_id"] },
  {
    table: WorldSceneUndeploymentModel.tableName,
    key: ["world_id", "deployment_id"],
  },
  {
    table: WorldDeploymentPositionWatermarkModel.tableName,
    key: ["world_id", "position"],
  },
]

function literal(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

// Everything recorded so far came from the configured worlds content server.
function defaultSource(): string {
  return normalizeContentServerUrl(
    new URL(
      env(
        "WORLDS_CONTENT_SERVER_URL",
        "https://worlds-content-server.decentraland.org"
      )
    )
  )
}

// Several worlds servers can serve the same world name. World places and removal watermarks record
// the server they came from, so a removal only retires what that server deployed, and world
// settings record the server whose version counter they carry.
export async function up(pgm: MigrationBuilder): Promise<void> {
  const source = defaultSource()

  // Nullable: Genesis City rows have no worlds server. World rows written by a previous release
  // during the rollout stay null and are read as the configured server.
  pgm.addColumn(PlaceModel.tableName, {
    content_server_url: { type: Type.Text, notNull: false },
  })
  pgm.sql(`
    UPDATE ${PlaceModel.tableName}
    SET "content_server_url" = ${literal(source)}
    WHERE "world" IS TRUE
  `)

  pgm.addColumn(WorldModel.tableName, {
    settings_source: { type: Type.Text, notNull: false },
  })
  pgm.sql(`
    UPDATE ${WorldModel.tableName}
    SET "settings_source" = ${literal(source)}
    WHERE "settings_version" IS NOT NULL
  `)

  // The default backfills existing rows. The server goes last in each key so lookups that ignore it
  // keep using the index. A previous release's upserts name the old keys and fail until it drains.
  for (const { table, key } of WATERMARK_KEYS) {
    pgm.addColumn(table, {
      content_server_url: { type: Type.Text, notNull: true, default: source },
    })
    pgm.dropConstraint(table, `${table}_pkey`)
    pgm.addConstraint(table, `${table}_pkey`, {
      primaryKey: [...key, "content_server_url"],
    })
  }
}

// Rows from other servers have no place under the old keys, so they are dropped.
export async function down(pgm: MigrationBuilder): Promise<void> {
  const source = defaultSource()

  for (const { table, key } of WATERMARK_KEYS) {
    pgm.sql(
      `DELETE FROM ${table} WHERE "content_server_url" <> ${literal(source)}`
    )
    pgm.dropConstraint(table, `${table}_pkey`)
    pgm.dropColumn(table, "content_server_url")
    pgm.addConstraint(table, `${table}_pkey`, { primaryKey: key })
  }

  pgm.dropColumn(WorldModel.tableName, "settings_source")
  pgm.dropColumn(PlaceModel.tableName, "content_server_url")
}
