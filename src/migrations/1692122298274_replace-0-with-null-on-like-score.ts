import { SQL, table } from "decentraland-gatsby/dist/entities/Database/utils"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel, { MIN_USER_ACTIVITY } from "../entities/Place/model"
import UserLikesModel from "../entities/UserLikes/model"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.db.query(
    SQL`UPDATE ${table(PlaceModel)} SET like_score = NULL WHERE like_score = 0`
  )

  const query = SQL`
  UPDATE ${table(PlaceModel)} 
    SET like_rate = 
      (
        SELECT (CASE WHEN c.count_active_total::float = 0 THEN NULL
          ELSE c.count_active_likes / c.count_active_total::float END)
        FROM (
          SELECT
            count(*) filter (where "like") as count_likes,
            count(*) filter (where not "like") as count_dislikes,
            count(*) filter (where "user_activity" >= ${MIN_USER_ACTIVITY}) as count_active_total,
            count(*) filter (where "like" and "user_activity" >= ${MIN_USER_ACTIVITY}) as count_active_likes,
            count(*) filter (where not "like" and "user_activity" >= ${MIN_USER_ACTIVITY}) as count_active_dislikes
          FROM ${table(UserLikesModel)} ul
          WHERE ul.place_id = places.id
        ) c
      )`

  pgm.db.query(query)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.db.query(
    SQL`UPDATE ${table(PlaceModel)} SET like_score = 0 WHERE like_score IS NULL`
  )

  pgm.db.query(
    SQL`UPDATE ${table(PlaceModel)} SET like_rate = 0 WHERE like_rate IS NULL`
  )
}
