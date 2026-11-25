import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import env from "decentraland-gatsby/dist/utils/env"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import { getTrustedWorldsContentServerUrl } from "../entities/CheckScenes/task/contentServerUrl"
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

// Everything recorded so far came from the configured worlds content server.
function defaultSource(): string {
  return getTrustedWorldsContentServerUrl(
    env(
      "WORLDS_CONTENT_SERVER_URL",
      "https://worlds-content-server.decentraland.org"
    )
  )
}

// Several worlds servers can serve the same world name. World places and removal watermarks record
// the server they came from, so a removal only retires what that server deployed, and world
// settings record the server whose version counter they carry.
export async function up(pgm: MigrationBuilder): Promise<void> {
  const source = defaultSource()

  // Nullable and not backfilled: null is read as the configured server, and Genesis City rows have
  // no worlds server.
  pgm.addColumn(PlaceModel.tableName, {
    content_server_url: { type: Type.Text, notNull: false },
  })
  pgm.addColumn(WorldModel.tableName, {
    settings_source: { type: Type.Text, notNull: false },
  })

  // The default fills existing rows and is then dropped, so every later write names its server. The
  // server goes last in each key so lookups that ignore it keep using the index. A previous
  // release's upserts name the old keys and fail until it drains.
  for (const { table, key } of WATERMARK_KEYS) {
    pgm.addColumn(table, {
      content_server_url: { type: Type.Text, notNull: true, default: source },
    })
    pgm.alterColumn(table, "content_server_url", { default: null })
    pgm.dropConstraint(table, `${table}_pkey`)
    pgm.addConstraint(table, `${table}_pkey`, {
      primaryKey: [...key, "content_server_url"],
    })
  }
}

class IrreversibleWorldContentServerSourcesMigrationError extends Error {
  constructor() {
    super(
      "The world content server sources migration is irreversible because folding other servers' watermarks back into the old keys would drop them and let retired deployments replay."
    )
    this.name = "IrreversibleWorldContentServerSourcesMigrationError"
  }
}

export async function down(): Promise<void> {
  throw new IrreversibleWorldContentServerSourcesMigrationError()
}
