import { Model } from "decentraland-gatsby/dist/entities/Database/model"
import {
  SQL,
  join,
  objectValues,
  table,
} from "decentraland-gatsby/dist/entities/Database/utils"

import { PlaceActivityDailyAttributes } from "./types"

export default class PlaceActivityModel extends Model<PlaceActivityDailyAttributes> {
  static tableName = "place_activity_daily"
  static withTimestamps = false

  static async findLatest(): Promise<Date | null> {
    const sql = SQL`SELECT "date" FROM ${table(this)} ORDER BY "date" LIMIT 1`
    const dates: [Date][] = await this.query(sql)
    if (dates && dates[0] && dates[0][0]) {
      return dates[0][0]
    }

    return null
  }

  static async createMany(activity: PlaceActivityDailyAttributes[]) {
    if (activity.length === 0) {
      return 0
    }

    const keys = Object.keys(activity[0])
    const sql = SQL`
      INSERT INTO ${table(this)}
        (${join(keys.map((key) => SQL.raw(`"${key}"`)))})
      VALUES
        ${objectValues(keys, activity)}
    `

    return this.rowCount(sql)
  }
}
