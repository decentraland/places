/* eslint-disable @typescript-eslint/naming-convention */
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"
import PlaceCategories from "../entities/PlaceCategories/model"
import PlacePositionModel from "../entities/PlacePosition/model"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(
    `UPDATE ${PlaceModel.tableName} SET categories = '{}' WHERE world IS true`
  )
  pgm.sql(
    `DELETE FROM ${PlaceCategories.tableName} pc WHERE pc.place_id IN (SELECT p.id FROM ${PlaceModel.tableName} p WHERE p.world IS true)`
  )
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  const { content } = await import("../seed/base_categorized_content.json")

  const processed = content.reduce((acc, curr) => {
    if (acc[curr.category_id]) {
      acc[curr.category_id].push(curr.base_position)
    } else {
      acc[curr.category_id] = [curr.base_position]
    }
    return acc
  }, {} as Record<string, string[]>)

  for (const [category, positions] of Object.entries(processed)) {
    pgm.sql(`UPDATE ${PlaceModel.tableName}
      SET categories = array_append(categories, '${category}')
      WHERE
        disabled IS false AND world IS true AND base_position IN (
        SELECT DISTINCT(pp.base_position)
        FROM ${PlacePositionModel.tableName} pp
        WHERE pp.position IN (${positions.map((pos) => `'${pos}'`).join(",")})
      )
    `)

    pgm.sql(`
    INSERT INTO ${PlaceCategories.tableName} (category_id, place_id)
    SELECT
      '${category}', p.id 
      FROM ${PlaceModel.tableName} p
      WHERE 
        p.disabled IS false
        AND p.world IS true
        AND p.base_position IN (
          SELECT DISTINCT(pp.base_position)
          FROM ${PlacePositionModel.tableName} pp
          WHERE pp.position IN (${positions.map((pos) => `'${pos}'`).join(",")})
     )
  `)
  }
}
