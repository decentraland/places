import { Model } from "decentraland-gatsby/dist/entities/Database/model"

import { PlaceContentRatingAttributes } from "./types"

export default class PlaceContentRatingModel extends Model<PlaceContentRatingAttributes> {
  static tableName = "place_content_ratings"
  static primaryKey = "id"
  static withTimestamps = false
}
