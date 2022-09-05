import { Model } from "decentraland-gatsby/dist/entities/Database/model"
import {
  SQL,
  columns,
  conditional,
  createSearchableMatches,
  join,
  limit,
  objectValues,
  offset,
  table,
  tsquery,
  values,
} from "decentraland-gatsby/dist/entities/Database/utils"

import {
  EntityPlaceAttributes,
} from "./types"

export default class EntityPlaceModel extends Model<EntityPlaceAttributes> {
  static tableName = "entities_places"
  static withTimestamps = false
  static primaryKey = 'entity_id'

  static async createMany(entity: EntityPlaceAttributes[]) {
    if (entity.length === 0) {
      return 0
    }

    const keys = Object.keys(entity[0])
    const sql = SQL`
      INSERT INTO ${table(this)}
        (${join(keys.map(key => SQL.raw(`"${key}"`)))})
      VALUES
        ${objectValues(keys, entity)}
    `

    return this.rowCount(sql)
  }
}
