import { RoadPositionAttributes } from "./types"
import { Model } from "../Database/model"

/**
 * The Genesis City parcels that are roads.
 *
 * Roads are deployed as ordinary scenes and register as ordinary places, so nothing on the place
 * row says "this is a road": they carry the Foundation as their contact and a generated title. The
 * map is the only authority, and its road list lives here so the feed can exclude them by
 * `base_position` with an indexed lookup instead of binding 9,434 parcels on every request.
 *
 * Seeded once by migration from `src/__data__/RoadCoordinates.json`; `bin/roads.ts` is the script
 * that regenerates that file from the map.
 */
export default class RoadPositionModel extends Model<RoadPositionAttributes> {
  static tableName = "road_positions"
  static primaryKey = "position"
}
