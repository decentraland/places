import { Model } from "decentraland-gatsby/dist/entities/Database/model"
import {
  UserAttributes,
} from "./types"

export default class UserModel extends Model<UserAttributes> {
  static tableName = "users"
  static primaryKey = "user"
}
