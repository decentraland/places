import { Model } from "decentraland-gatsby/dist/entities/Database/model"
import {
  SQL,
  table,
  values,
} from "decentraland-gatsby/dist/entities/Database/utils"

import EntityPlaceModel from "../EntityPlace/model"
import UserFavoriteModel from "../UserFavorite/model"
import UserLikesModel from "../UserLikes/model"
import { PlaceAttributes } from "./types"

export default class PlaceModel extends Model<PlaceAttributes> {
  static tableName = "places"

  static async findByEntityIds(
    entityIds: string[]
  ): Promise<(PlaceAttributes & { entity_id: string })[]> {
    if (entityIds.length === 0) {
      return []
    }
    const sql = SQL`
      SELECT * FROM ${table(this)} p
      LEFT JOIN ${table(EntityPlaceModel)} ep ON "p"."id" = "ep"."place_id"
      WHERE "ep"."entity_id" IN ${values(entityIds)}
    `

    return this.query(sql)
  }

  static async findEnabledByPositions(
    positions: string[]
  ): Promise<PlaceAttributes[]> {
    if (positions.length === 0) {
      return []
    }

    const sql = SQL`
      SELECT * FROM ${table(this)}
      WHERE "disabled" = false
        AND "positions" && ${"{" + JSON.stringify(positions).slice(1, -1) + "}"}
    `

    return this.namedQuery(this.tableName + "_find_enabled_by_positions", sql)
  }

  static async disablePlaces(placesIds: string[]) {
    const now = new Date()
    return this.updateTo(
      { disabled: true, disabled_at: now },
      { id: placesIds }
    )
  }

  static async updateFavorites(placeId: string) {
    const sql = SQL`
    WITH counted AS (
      SELECT count(*) AS count
      FROM ${table(UserFavoriteModel)}
      WHERE "place_id" = ${placeId}
    ) 
    UPDATE ${table(this)}
      SET "favorites" = c.count
      FROM counted c
      WHERE "id" = ${placeId}
    `
    return this.namedQuery(this.tableName + "_update_favorites", sql)
  }

  static async updateLikes(placeId: string) {
    const sql = SQL`
    WITH counted AS (
      SELECT count(*) filter (where "like") as count_likes,
       count(*) filter (where not "like") as count_dislikes
      FROM ${table(UserLikesModel)}
      WHERE "place_id" = ${placeId}
    ) 
    UPDATE ${table(this)}
      SET "likes" = c.count_likes, "dislikes" = c.count_dislikes
      FROM counted c
      WHERE "id" = ${placeId}
    `
    return this.namedQuery(this.tableName + "_update_likes", sql)
  }
}
