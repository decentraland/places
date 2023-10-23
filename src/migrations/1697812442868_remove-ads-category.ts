/* eslint-disable @typescript-eslint/naming-convention */
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"
import PlaceCategories from "../entities/PlaceCategories/model"
import PlacePositionModel from "../entities/PlacePosition/model"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DELETE FROM ${PlaceCategories.tableName} WHERE category_id = 'ads'`)

  const { content } = await import("../seed/base_categorized_content.json")

  const adsPlaces = content.filter(({ category_id }) => category_id == "ads")

  pgm.sql(`UPDATE ${PlaceModel.tableName} p
    SET categories = array_remove(categories, 'ads')
    WHERE
      disabled is false
      AND base_position IN (
      SELECT DISTINCT(pp.base_position)
      FROM ${PlacePositionModel.tableName} pp
      WHERE pp.position IN (${adsPlaces
        .map(({ base_position }) => `'${base_position}'`)
        .join(",")})
    )
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  const { content } = await import("../seed/base_categorized_content.json")

  const adsPlaces = content.filter(({ category_id }) => category_id == "ads")

  pgm.sql(`UPDATE ${PlaceModel.tableName}
    SET categories = array_append(categories, 'ads')
    WHERE
      disabled is false AND base_position IN (
      SELECT DISTINCT(pp.base_position)
      FROM ${PlacePositionModel.tableName} pp
      WHERE pp.position IN (${adsPlaces
        .map(({ base_position }) => `'${base_position}'`)
        .join(",")})
    )
 `)
  pgm.sql(`
    INSERT INTO ${PlaceCategories.tableName} (category_id, place_id)
    SELECT
      'ads', p.id 
      FROM ${PlaceModel.tableName} p
      WHERE 
        p.disabled is false
        AND p.base_position IN (
          SELECT DISTINCT(pp.base_position)
          FROM ${PlacePositionModel.tableName} pp
          WHERE pp.position IN (${adsPlaces
            .map(({ base_position }) => `'${base_position}'`)
            .join(",")})
  )`)
}
