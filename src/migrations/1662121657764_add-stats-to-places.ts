/* eslint-disable @typescript-eslint/naming-convention */
import { Type } from 'decentraland-gatsby/dist/entities/Database/types';
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';
import PlaceModel from '../entities/Place/model';

export const shorthands: ColumnDefinitions = {
  favorites: {
    type: Type.Integer,
    notNull: true,
    default: 0.
  },
  likes: {
    type: Type.Integer,
    notNull: true,
    default: 0.
  },
  dislikes: {
    type: Type.Integer,
    notNull: true,
    default: 0.
  },
};

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns(PlaceModel.tableName, shorthands)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns(PlaceModel.tableName, Object.keys(shorthands))
}
