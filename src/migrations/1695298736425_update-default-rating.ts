import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { SQL, table } from "decentraland-gatsby/dist/entities/Database/utils"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"
import PlaceContentRatingModel from "../entities/PlaceContentRating/model"

export const shorthands: ColumnDefinitions = {
  id: {
    type: Type.UUID,
    primaryKey: true,
  },
  place_id: {
    type: Type.UUID,
    notNull: true,
  },
  original_rating: {
    type: Type.Varchar(4),
    notNull: false,
  },
  update_rating: {
    type: Type.Varchar(4),
    notNull: true,
  },
  moderator: {
    type: Type.Address,
    notNull: true,
  },
  comment: {
    type: Type.Text,
    notNull: false,
  },
  created_at: {
    type: Type.TimeStampTZ,
    default: "now()",
    notNull: true,
  },
}

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.db.query(
    SQL`UPDATE ${table(
      PlaceModel
    )} set "content_rating" = 'PR' WHERE "content_rating" is null`
  )
  pgm.db.query(
    SQL`UPDATE ${table(
      PlaceModel
    )} set "content_rating" = 'A' WHERE "content_rating" = 'M'`
  )
  pgm.alterColumn(PlaceModel.tableName, "content_rating", {
    type: "VARCHAR(4)",
    default: "PR",
    notNull: true,
  })

  pgm.createTable(PlaceContentRatingModel.tableName, shorthands)
  pgm.createIndex(PlaceContentRatingModel.tableName, ["place_id", "created_at"])
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex(PlaceContentRatingModel.tableName, ["place_id", "created_at"])
  pgm.dropTable(PlaceContentRatingModel.tableName)

  pgm.alterColumn(PlaceModel.tableName, "content_rating", {
    type: Type.Text,
  })
}
