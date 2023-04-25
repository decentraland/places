import { Model } from "decentraland-gatsby/dist/entities/Database/model"

import { CheckSceneLogs } from "./types"

export default class CheckScenesModel extends Model<CheckSceneLogs> {
  static tableName = "check_scenes_logs"
}
