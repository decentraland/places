import { Model } from "decentraland-gatsby/dist/entities/Database/model"
import {
  SQL,
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
    if (entityIds.length === 0) {
      return []
    }
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

    return this.namedQuery(this.tableName + "_find_enabled_by_positions", sql)
  }

  static async disablePlaces(placesIds: string[]) {
    const now = new Date()
    return this.updateTo(
      { disabled: true, disabled_at: now },
      { id: placesIds }
    )
  }
}
