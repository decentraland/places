import { Model } from "decentraland-gatsby/dist/entities/Database/model"
import { SQL, table } from "decentraland-gatsby/dist/entities/Database/utils"

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
}
