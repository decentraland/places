/* eslint-disable @typescript-eslint/naming-convention */
import { Type } from 'decentraland-gatsby/dist/entities/Database/types';
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';
import PlaceActivityDailyModel from '../entities/PlaceActivityDaily/model';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(PlaceActivityDailyModel.tableName, {
    place_id: {
      type: Type.UUID,
      primaryKey: true
    },
    users: {
      type: Type.Integer,
      notNull: true,
    },
    checks: {
      type: Type.Integer,
      notNull: true,
    },
    date: {
      type: Type.Date,
      primaryKey: true,
    }
  })

  pgm.createIndex(PlaceActivityDailyModel.tableName, ['date'])
  pgm.createIndex(PlaceActivityDailyModel.tableName, ['place_id', 'date'])
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(PlaceActivityDailyModel.tableName, { cascade: true })
}
