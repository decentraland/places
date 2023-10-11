/* eslint-disable @typescript-eslint/naming-convention */

import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"
import PlaceCategories from "../entities/PlaceCategories/model"

export const shorthands: ColumnDefinitions | undefined = undefined

const MAPPED: Record<string, string> = {
  gaming: "game",
  gambling: "casino",
  commercial: "shop",
  sport: "sports",
}

export async function up(pgm: MigrationBuilder): Promise<void> {
  const { content } = await import("../seed/base_categorized_content.json")

  let tmpRows = []
  const placesMap: Record<string, string[]> = {}
  for (const row of content) {
    if (row.category_id === "ads") continue

    const place = placesMap[row.place_id]
    const category = MAPPED[row.category_id] || row.category_id

    tmpRows.push(`('${row.place_id}', '${category}')`)

    if (!place) {
      placesMap[row.place_id] = [category]
    } else {
      place.push(category)
    }

    if (tmpRows.length === 100) {
      pgm.sql(
        `INSERT INTO ${
          PlaceCategories.tableName
        } (place_id, category_id) VALUES ${tmpRows.join(",")}`
      )
      tmpRows = []
    }
  }

  for (const key in placesMap) {
    const place = placesMap[key].join(",")
    pgm.sql(
      `UPDATE ${PlaceModel.tableName} SET categories = array_cat(categories, '{${place}}') WHERE id = '${key}'`
    )
  }
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  const { content } = await import("../seed/base_categorized_content.json")

  const placesMap: Record<string, string[]> = {}
  for (const row of content) {
    if (row.category_id === "ads") continue

    const place = placesMap[row.place_id]
    const category = MAPPED[row.category_id] || row.category_id

    if (!place) {
      placesMap[row.place_id] = [category]
    } else {
      place.push(category)
    }

    pgm.sql(
      `DELETE FROM ${PlaceCategories.tableName} WHERE place_id = '${row.place_id}' AND category_id = '${category}'`
    )
  }

  for (const key in placesMap) {
    const place = placesMap[key]

    for (const cat of place) {
      pgm.sql(
        `UPDATE ${PlaceModel.tableName} SET categories = array_remove(categories, '${cat}') WHERE id = '${key}'`
      )
    }
  }
}
