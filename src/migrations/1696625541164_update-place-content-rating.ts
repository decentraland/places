import { MigrationBuilder } from "node-pg-migrate"

import PlaceContentRatingModel from "../entities/PlaceContentRating/model"

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.alterColumn(PlaceContentRatingModel.tableName, "moderator", {
    notNull: false,
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(
    `UPDATE "${PlaceContentRatingModel.tableName}" SET moderator = '-' WHERE moderator IS NULL`
  )
  pgm.alterColumn(PlaceContentRatingModel.tableName, "moderator", {
    notNull: true,
  })
}
