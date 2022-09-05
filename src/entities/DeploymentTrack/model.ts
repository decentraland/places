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
import { PlaceAttributes } from "../Place/types"

import {
  DeploymentTrackAttributes,
} from "./types"

export default class DeploymentTrackModel extends Model<DeploymentTrackAttributes> {
  static tableName = "deployment_tracks"
}
