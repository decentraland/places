/* eslint-disable @typescript-eslint/naming-convention */
import { Type } from 'decentraland-gatsby/dist/entities/Database/types';
import Catalyst from 'decentraland-gatsby/dist/utils/api/Catalyst';
import { server } from 'decentraland-server';
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';
import isURL from 'validator/lib/isURL';
import DeploymentTrackModel from '../entities/DeploymentTrack/model';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(DeploymentTrackModel.tableName, {
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
      notNull: true
    },
    from: {
      type: Type.BigInt,
      default: 0,
      notNull: true
    },
    limit: {
      type: Type.SmallInt,
      default: 0,
      notNull: true
    },
    disabled: {
      type: Type.Boolean,
      default: false,
      notNull: true
    },
    disabled_at: {
      type: Type.TimeStampTZ,
    },
    created_at: {
      type: Type.TimeStampTZ,
      default: 'now()',
      notNull: true,
    },
    updated_at: {
      type: Type.TimeStampTZ,
      default: 'now()',
      notNull: true,
    },
  })

  if (isURL(process.env.BOOSTRAP_CATALYST || '')) {
    const servers = await Catalyst.from(process.env.BOOSTRAP_CATALYST!).getServers()
    if (servers.length) {
      let sql = `INSERT INTO "${DeploymentTrackModel.tableName}"
          ("id", "base_url", "owner", "from", "limit", "disabled", "disabled_at", "created_at", "updated_at")
        VALUES`

      for (const server of servers) {
        if (server !== servers[0]) {
          sql += ',\n'
        }

        sql += `('${server.id}', '${server.baseUrl}', '${server.owner}', 0, 100, false, null, NOW(), NOW())`
      }

      pgm.sql(sql)
    }

  }
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(DeploymentTrackModel.tableName, { cascade: true })
}
