/* eslint-disable @typescript-eslint/naming-convention */
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"
import PlaceCategories from "../entities/PlaceCategories/model"
import PlacePositionModel from "../entities/PlacePosition/model"

export const shorthands: ColumnDefinitions | undefined = undefined

const PLACES = [
  "-87,-4",
  " -74,-17",
  "-76,-9",
  "-107,-15",
  "-57,-57",
  " -131,-118",
]

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`UPDATE ${PlaceModel.tableName}
  SET categories = array_append(categories, 'business')
  WHERE
    disabled is false AND base_position IN (
    SELECT DISTINCT(pp.base_position)
    FROM ${PlacePositionModel.tableName} pp
    WHERE pp.position IN (${PLACES.map((pos) => `'${pos}'`).join(",")})
  )
`)
  pgm.sql(`
  INSERT INTO ${PlaceCategories.tableName} (category_id, place_id)
  SELECT
    'business', p.id 
    FROM ${PlaceModel.tableName} p
    WHERE 
      p.disabled is false
      AND p.base_position IN (
        SELECT DISTINCT(pp.base_position)
        FROM ${PlacePositionModel.tableName} pp
        WHERE pp.position IN (${PLACES.map((pos) => `'${pos}'`).join(",")})
)`)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`UPDATE ${PlaceModel.tableName}
  SET categories = array_remove(categories, 'business')
  WHERE
    disabled is false AND base_position IN (
    SELECT DISTINCT(pp.base_position)
    FROM ${PlacePositionModel.tableName} pp
    WHERE pp.position IN (${PLACES.map((pos) => `'${pos}'`).join(",")})
  )
`)
  pgm.sql(
    `DELETE FROM ${PlaceCategories.tableName} WHERE category_id = 'business'`
  )
}
