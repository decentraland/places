import { Model } from "decentraland-gatsby/dist/entities/Database/model"

import { DeploymentTrackAttributes } from "./types"

export default class DeploymentTrackModel extends Model<DeploymentTrackAttributes> {
  static tableName = "deployment_tracks"
}
