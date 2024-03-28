/* eslint-disable @typescript-eslint/naming-convention */
import env from "decentraland-gatsby/dist/utils/env"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"
import PlaceCategoriesModel from "../entities/PlaceCategories/model"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  const { content } = await import("../seed/base_categorized_worlds.json")

  const isDev = env("PLACES_URL", "").includes(".zone") // .zone and .org runs with NODE_ENV=production, so we check the URL env var

  if (!isDev) {
    const processed = content.reduce((acc, curr) => {
      if (acc[curr.category_id]) {
        acc[curr.category_id].push(curr.world_name)
      } else {
        acc[curr.category_id] = [curr.world_name]
      }
      return acc
    }, {} as Record<string, string[]>)

    for (const [category, worldNames] of Object.entries(processed)) {
      pgm.sql(`UPDATE ${PlaceModel.tableName}
        SET categories = array_append(categories, '${category}')
        WHERE
          disabled is false AND world_name IN (${worldNames
            .map((name) => `'${name}'`)
            .join(",")})
      `)

      pgm.sql(`
      INSERT INTO ${PlaceCategoriesModel.tableName} (category_id, place_id)
      SELECT
        '${category}', p.id 
        FROM ${PlaceModel.tableName} p
        WHERE 
          p.disabled is false
          AND p.world_name IN (${worldNames
            .map((name) => `'${name}'`)
            .join(",")})
    `)
    }
  } else {
    // Mock categories for Dev Database
    const worldCategories = [
      ...new Set(content.map(({ category_id }) => category_id)),
    ]

    const pick = (times: number) => {
      const cats = []
      for (let i = times; i > 0; i--) {
        const element =
          worldCategories[Math.floor(Math.random() * worldCategories.length)]
        cats.push(element)
      }
      return [...new Set(cats)]
    }
    const worlds = (await pgm.db.select(
      `SELECT world_name, id FROM places WHERE disabled IS false and world IS true`
    )) as { id: string; world_name: string }[]

    for (const { id, world_name } of worlds) {
      const categories = pick(Math.floor(Math.random() * (3 - 1 + 1) + 1))
      for (const category of categories) {
        pgm.sql(
          `UPDATE ${PlaceModel.tableName} SET categories = array_append(categories, '${category}') WHERE world_name = '${world_name}'`
        )
        pgm.sql(
          `INSERT INTO ${PlaceCategoriesModel.tableName} (category_id, place_id) VALUES ('${category}', '${id}')`
        )
      }
    }
  }
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(
    `UPDATE ${PlaceModel.tableName} SET categories = '{}' WHERE world IS true`
  )
  pgm.sql(
    `DELETE FROM ${PlaceCategoriesModel.tableName} pc WHERE pc.place_id IN (SELECT p.id FROM ${PlaceModel.tableName} p WHERE p.world IS true)`
  )
}
