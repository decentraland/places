import { Model } from "decentraland-gatsby/dist/entities/Database/model"
import {
  SQL,
  join,
  table,
  values,
} from "decentraland-gatsby/dist/entities/Database/utils"

import { PlaceAttributes } from "../Place/types"
import { PlacePositionAttributes } from "./types"

export default class PlacePositionModel extends Model<PlacePositionAttributes> {
  static tableName = "place_positions"
  static primaryKey = "position"

  static async findeBasePositions(positions: string[]): Promise<string[]> {
    if (positions.length === 0) {
      return []
    }

    const query = SQL`
      SELECT DISTINCT(base_position)
      FROM ${table(this)}
      WHERE position IN ${values(positions)}
    `

    return this.namedQuery<string>("find_base_positions", query)
  }

  static async removePositions(positions: string[]): Promise<number> {
    if (positions.length === 0) {
      return 0
    }

    const query = SQL`
      DELETE FROM ${table(this)}
      WHERE position IN ${values(positions)}
    `

    return this.namedRowCount("remove_positions", query)
  }

  static async syncBasePosition(
    place: Pick<PlaceAttributes, "base_position" | "positions">
  ): Promise<number> {
    let updates = 0
    if (place.positions.length === 0) {
      return updates
    }

    const missingPositions = new Set(place.positions)
    const existingPositions = await this.namedQuery<PlacePositionAttributes>(
      `find_existing_positions`,
      SQL`SELECT * FROM ${table(this)} WHERE position IN ${values(
        place.positions
      )}`
    )

    for (const existingPosition of existingPositions) {
      missingPositions.delete(existingPosition.position)
    }

    updates += await this.namedRowCount(
      "update_base_positions",
      SQL`
      UPDATE ${table(this)}
        SET base_position = ${place.base_position}
        WHERE position IN ${values(place.positions)}
    `
    )

    if (missingPositions.size > 0) {
      updates += await this.namedRowCount(
        "create_base_positions",
        SQL`
        INSERT INTO ${table(this)} (position, base_position)
          VALUES ${join(
            Array.from(missingPositions).map((position) =>
              values([position, place.base_position])
            )
          )}
      `
      )
    }

    updates += await this.namedRowCount(
      "remove_base_positions",
      SQL`
      DELETE FROM ${table(this)}
      WHERE
        base_position = ${place.base_position}
        AND position NOT IN ${values(place.positions)}
    `
    )

    return updates
  }
}
