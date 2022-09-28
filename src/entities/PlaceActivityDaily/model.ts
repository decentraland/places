import { Model } from "decentraland-gatsby/dist/entities/Database/model"
import { SQL, table } from "decentraland-gatsby/dist/entities/Database/utils"

import { PlaceActivityDailyAttributes } from "./types"

export default class PlaceActivityDailyModel extends Model<PlaceActivityDailyAttributes> {
  static tableName = "place_activity_daily"
  static withTimestamps = false

  static async findLatest(): Promise<Date | null> {
    const sql = SQL`SELECT "date" FROM ${table(
      this
    )} ORDER BY "date" DESC LIMIT 1`
    const dates: { date: Date }[] = await this.namedQuery("find_lates", sql)
    if (dates && dates[0]) {
      return dates[0].date
    }

    return null
  }
}
