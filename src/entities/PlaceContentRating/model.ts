import { PlaceContentRatingAttributes } from "./types"
import { Model } from "../Database/model"

export default class PlaceContentRatingModel extends Model<PlaceContentRatingAttributes> {
  static tableName = "content_ratings"
  static primaryKey = "id"
  static withTimestamps = false
}
