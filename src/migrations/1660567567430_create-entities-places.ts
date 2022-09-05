/* eslint-disable @typescript-eslint/naming-convention */
import { Type } from 'decentraland-gatsby/dist/entities/Database/types';
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';
import EntityPlaceModel from '../entities/EntityPlace/model';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(EntityPlaceModel.tableName, {
    place_id: {
      type: Type.UUID,
      primaryKey: true
    },
    entity_id: {
      type: Type.Text,
      primaryKey: true
    },
  })

}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(EntityPlaceModel.tableName, { cascade: true })
}
