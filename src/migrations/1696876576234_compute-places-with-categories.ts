/* eslint-disable @typescript-eslint/naming-convention */

import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceCategories from "../entities/PlaceCategories/model"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  const { content } = await import("../seed/base_categorized_content.json")

  let tmpRows = []
  for (const row of content) {
    if (row.category_id === "ads") continue
    tmpRows.push(`('${row.place_id}', '${row.category_id}')`)

    if (tmpRows.length === 100) {
      pgm.sql(
        `INSERT INTO ${
          PlaceCategories.tableName
        } (place_id, category_id) VALUES ${tmpRows.join(",")}`
      )
      tmpRows = []
    }
  }
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  const { content } = await import("../seed/base_categorized_content.json")

  for (const row of content) {
    if (row.category_id === "ads") continue

    pgm.sql(
      `DELETE FROM ${PlaceCategories.tableName} WHERE place_id = '${row.place_id}' AND category_id = '${row.category_id}'`
    )
  }
}
