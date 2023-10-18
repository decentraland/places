import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"
import PlaceCategoriesModel from "../entities/PlaceCategories/model"
import PlacePositionModel from "../entities/PlacePosition/model"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
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
        disabled is false AND base_position IN (
        SELECT DISTINCT(pp.base_position)
        FROM ${PlacePositionModel.tableName} pp
        WHERE pp.position IN (${positions.map((pos) => `'${pos}'`).join(",")})
      )
    `)

    pgm.sql(`
    INSERT INTO ${PlaceCategoriesModel.tableName} (category_id, place_id)
    SELECT
      '${category}', p.id 
      FROM ${PlaceModel.tableName} p
      WHERE 
        p.disabled is false
        AND p.base_position IN (
          SELECT DISTINCT(pp.base_position)
          FROM ${PlacePositionModel.tableName} pp
          WHERE pp.position IN (${positions.map((pos) => `'${pos}'`).join(",")})
     )
  `)
  }
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  const { content } = await import("../seed/base_categorized_content.json")

  for (const value of content) {
    pgm.sql(`UPDATE ${PlaceModel.tableName} p
      SET categories = array_remove(categories, '${value.category_id}')
      WHERE
        disabled is false
        AND base_position IN (
        SELECT DISTINCT(pp.base_position)
        FROM ${PlacePositionModel.tableName} pp
        WHERE '${value.base_position}' = pp.position
      )
    `)
    pgm.sql(`
      DELETE FROM ${PlaceCategoriesModel.tableName}
      WHERE category_id = '${value.category_id}' AND place_id IN (
      SELECT
        p.id 
        FROM ${PlaceModel.tableName} p
        WHERE 
          p.disabled is false
          AND p.base_position IN (
            SELECT DISTINCT(pp.base_position)
            FROM ${PlacePositionModel.tableName} pp
            WHERE '${value.base_position}' = pp.position
          )
      )
    `)
  }
}
