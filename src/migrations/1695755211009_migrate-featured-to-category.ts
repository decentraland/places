/* eslint-disable @typescript-eslint/naming-convention */

import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"
import PlaceCategories from "../entities/PlaceCategories/model"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  const currentFeaturedPlaces: { id: string }[] = await pgm.db.select(
    `SELECT id FROM ${PlaceModel.tableName} WHERE featured IS TRUE`
  )

  const featuredPlaces = currentFeaturedPlaces
    .map(({ id }) => `('${id}', 'featured')`)
    .join(",")

  pgm.sql(
    `INSERT INTO ${PlaceCategories.tableName} (place_id, category_id) VALUES ${featuredPlaces}`
  )

  pgm.dropColumns(PlaceModel.tableName, ["featured", "featured_image"])
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns(PlaceModel.tableName, {
    featured: {
      notNull: true,
      type: Type.Boolean,
      default: false,
    },
    featured_image: {
      notNull: false,
      type: Type.Text,
    },
  })

  const currentFeaturedPlaces = (
    (await pgm.db.select(
      `SELECT place_id as id FROM ${PlaceCategories.tableName} WHERE category_id = 'featured'`
    )) as { id: string }[]
  )
    .map(({ id }) => `'${id}'`)
    .join(",")

  pgm.sql(
    `UPDATE ${PlaceModel.tableName} SET featured = true WHERE id IN (${currentFeaturedPlaces})`
  )

  pgm.sql(
    `DELETE FROM ${PlaceCategories.tableName} WHERE place_id IN (${currentFeaturedPlaces}) AND category_id = 'featured'`
  )
}
