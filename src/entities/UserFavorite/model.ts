import { Model } from "decentraland-gatsby/dist/entities/Database/model"
import {
  UserFavoriteAttributes,
} from "./types"

export default class UserFavoriteModel extends Model<UserFavoriteAttributes> {
  static tableName = "user_favorites"
  static primaryKey = "user"
  static withTimestamps = false
}
