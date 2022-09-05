import { Model } from "decentraland-gatsby/dist/entities/Database/model"
import {
  SQL,
  join,
  objectValues,
  table,
} from "decentraland-gatsby/dist/entities/Database/utils"

import { PlaceActivityDailyAttributes } from "../PlaceActivityDaily/types"
import { PlaceActivityAttributes } from "./types"

export default class PlaceActivityModel extends Model<PlaceActivityAttributes> {
  static tableName = "place_activities"
  static withTimestamps = false

  static async getSummary(
    from: Date,
    to: Date
  ): Promise<PlaceActivityDailyAttributes[]> {
    const sql = SQL`
      SELECT
        "place_id",
        SUM("users") as "users",
        COUNT(*) as "checks",
        DATE("created_at") as "date"
      FROM
        ${table(this)}
      WHERE
        "created_at" BETWEEN ${from} AND ${to}
      GROUP BY "place_id", "date"
    `

    return this.query(sql)
  }

  //
  // static async clearFrom(from: Date) {
  //   const sql = SQL`DELETE FROM ${table(this)} WHERE "created_at" < ${from}`
  //   return this.rowCount(sql)
  // }
  //

  static async createMany(places: PlaceActivityAttributes[]) {
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
}
