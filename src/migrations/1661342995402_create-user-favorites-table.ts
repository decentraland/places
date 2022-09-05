/* eslint-disable @typescript-eslint/naming-convention */
import { Type } from 'decentraland-gatsby/dist/entities/Database/types';
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';
import UserFavoriteModel from '../entities/UserFavorite/model';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(UserFavoriteModel.tableName, {
    place_id: {
      type: Type.UUID,
      primaryKey: true,
    },
    user: {
      type: Type.Address,
      primaryKey: true,
    },
    user_activity: {
      type: Type.Integer,
      default: 0,
      notNull: true
    },
    created_at: {
      type: Type.TimeStampTZ,
      default: 'now()',
      notNull: true,
    },
  })

  pgm.createIndex(UserFavoriteModel.tableName, [ 'place_id', 'user_activity' ])
  pgm.createIndex(UserFavoriteModel.tableName, [ 'user', 'user_activity' ])

}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(UserFavoriteModel.tableName, { cascade: false })
}
