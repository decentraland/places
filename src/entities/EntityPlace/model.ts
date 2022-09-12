import { Model } from "decentraland-gatsby/dist/entities/Database/model"

import { EntityPlaceAttributes } from "./types"

export default class EntityPlaceModel extends Model<EntityPlaceAttributes> {
  static tableName = "entities_places"
  static withTimestamps = false
  static primaryKey = "entity_id"
}
