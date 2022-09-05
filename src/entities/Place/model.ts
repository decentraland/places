import { Model } from "decentraland-gatsby/dist/entities/Database/model"
import {
  SQL,
  join,
  objectValues,
  table,
  values,
} from "decentraland-gatsby/dist/entities/Database/utils"

import EntityPlaceModel from "../EntityPlace/model"
import { PlaceAttributes } from "./types"

export default class PlaceModel extends Model<PlaceAttributes> {
  static tableName = "places"

  static async findByEntityIds(
    entityIds: string[]
  ): Promise<(PlaceAttributes & { entity_id: string })[]> {
    const sql = SQL`
      SELECT * FROM ${table(this)} p
      LEFT JOIN ${table(EntityPlaceModel)} ep ON "p"."id" = "ep"."place_id"
      WHERE "ep"."entity_id" IN ${values(entityIds)}
    `

    return this.query(sql)
  }

  static async findEnabledByPositions(
    positions: string[]
  ): Promise<PlaceAttributes[]> {
    if (positions.length === 0) {
      return []
    }

    const sql = SQL`
      SELECT * FROM ${table(this)}
      WHERE "disabled" = false
        AND "positions" && ${"{" + JSON.stringify(positions).slice(1, -1) + "}"}
    `

    return this.query(sql)
  }

  static async createMany(places: PlaceAttributes[]) {
    if (places.length === 0) {
      return 0
    }

    const keys = Object.keys(places[0])
    const sql = SQL`
      INSERT INTO ${table(this)}
        (${join(keys.map((key) => SQL.raw(`"${key}"`)))})
      VALUES
        ${objectValues(keys, places)}
    `

    return this.rowCount(sql)
  }

  static async disablePlaces(placesIds: string[]) {
    if (placesIds.length === 0) {
      return 0
    }

    const now = new Date()
    const sql = SQL`
      UPDATE ${table(this)}
      SET
        "disabled" = true,
        "disabled_at" = ${now}
      WHERE
        "id" IN ${values(placesIds)}
    `

    return this.rowCount(sql)
  }
}
