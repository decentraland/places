/* eslint-disable @typescript-eslint/naming-convention */
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import CategoryModel from "../entities/Category/model"
import PlaceModel from "../entities/Place/model"
import PlaceCategories from "../entities/PlaceCategories/model"
import PlacePositionModel from "../entities/PlacePosition/model"

export const shorthands: ColumnDefinitions | undefined = undefined

const PLACES = ["95,111", "108,140"]
const CATEGORY_NAME = "parkour"

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    INSERT INTO ${CategoryModel.tableName} (name, active)
    VALUES ('${CATEGORY_NAME}', true)
  `)

  pgm.sql(`UPDATE ${PlaceModel.tableName}
  SET categories = array_append(categories, '${CATEGORY_NAME}')
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
    '${CATEGORY_NAME}', p.id 
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
  pgm.sql(
    `DELETE FROM ${PlaceCategories.tableName} WHERE category_id = '${CATEGORY_NAME}'`
  )

  pgm.sql(`UPDATE ${PlaceModel.tableName}
  SET categories = array_remove(categories, '${CATEGORY_NAME}')
  WHERE
    disabled is false AND base_position IN (
    SELECT DISTINCT(pp.base_position)
    FROM ${PlacePositionModel.tableName} pp
    WHERE pp.position IN (${PLACES.map((pos) => `'${pos}'`).join(",")})
  )
`)

  pgm.sql(`
    DELETE FROM ${CategoryModel.tableName} WHERE name = '${CATEGORY_NAME}'
  `)
}
