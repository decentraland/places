import { CheckSceneLogs } from "./types"
import { Model } from "../Database/model"

export default class CheckScenesModel extends Model<CheckSceneLogs> {
  static tableName = "check_scenes_logs"
}
