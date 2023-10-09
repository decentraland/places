/* eslint-disable @typescript-eslint/naming-convention */
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"
import PlaceCategories from "../entities/PlaceCategories/model"
import PlacePositionModel from "../entities/PlacePosition/model"
import { getPois } from "../modules/pois"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  const pois = (await getPois()).map((p) => `'${p}'`).join(",")

  const findEnabledByPositionsSQL = `
  SELECT id FROM ${PlaceModel.tableName}
  WHERE "disabled" is false
    AND "world" is false
    AND "base_position" IN (
      SELECT DISTINCT("base_position")
      FROM ${PlacePositionModel.tableName} "pp"
      WHERE "pp"."position" IN (${pois})
    )
  `

  const currentPois: { id: string }[] = await pgm.db.select(
    findEnabledByPositionsSQL
  )

  const poiPlaces = currentPois.map(({ id }) => `('${id}', 'poi')`).join(",")

  pgm.sql(
    `INSERT INTO ${PlaceCategories.tableName} (place_id, category_id) VALUES ${poiPlaces}`
  )
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DELETE FROM ${PlaceCategories.tableName} WHERE category_id = 'poi'`)
}
