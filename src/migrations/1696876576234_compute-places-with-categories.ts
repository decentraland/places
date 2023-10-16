import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"
import { unique } from "radash"

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

  const positions = content
    .map(({ base_position }) => `'${base_position}'`)
    .join(",")

  const ids: { id: string; base_position: string }[] = await pgm.db.select(
    `SELECT DISTINCT id, base_position FROM ${PlaceModel.tableName} WHERE base_position IN (${positions})`
  )

  let tmpRows = []
  for (const place of ids) {
    const categoryRecords = unique(
      content
        .filter(({ base_position }) => place.base_position === base_position)
        .map(({ category_id }) => category_id)
        .filter((category) => category != "ads")
    )

    for (const category of categoryRecords) {
      const mapped = MAPPED[category] || category
      tmpRows.push(`('${place.id}', '${mapped}')`)
    }

    pgm.sql(
      `UPDATE ${
        PlaceModel.tableName
      } SET categories = array_cat(categories, '{${categoryRecords.join(
        ","
      )}}') WHERE id = '${place.id}'`
    )

    if (tmpRows.length === 100) {
      pgm.sql(
        `INSERT INTO ${
          PlaceCategories.tableName
        } (place_id, category_id) VALUES ${tmpRows.join(",")}`
      )
      tmpRows = []
    }
  }

  if (tmpRows.length) {
    pgm.sql(
      `INSERT INTO ${
        PlaceCategories.tableName
      } (place_id, category_id) VALUES ${tmpRows.join(",")}`
    )
  }
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  const { content } = await import("../seed/base_categorized_content.json")

  const positions = content
    .map(({ base_position }) => `'${base_position}'`)
    .join(",")

  const ids: { id: string; base_position: string }[] = await pgm.db.select(
    `SELECT DISTINCT id, base_position FROM ${PlaceModel.tableName} WHERE base_position IN (${positions})`
  )

  for (const place of ids) {
    const categoryRecords = unique(
      content
        .filter(({ base_position }) => place.base_position === base_position)
        .map(({ category_id }) => category_id)
        .filter((category) => category != "ads")
    )

    for (const category of categoryRecords) {
      const mapped = MAPPED[category] || category
      pgm.sql(
        `DELETE FROM ${PlaceCategories.tableName} WHERE place_id = '${place.id}' AND category_id = '${mapped}'`
      )
      pgm.sql(
        `UPDATE ${PlaceModel.tableName} SET categories = array_remove(categories, '${mapped}') WHERE id = '${place.id}'`
      )
    }
  }
}
