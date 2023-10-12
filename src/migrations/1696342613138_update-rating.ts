import { SQL, table } from "decentraland-gatsby/dist/entities/Database/utils"
import { MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.db.query(
    SQL`UPDATE ${table(
      PlaceModel
    )} set "content_rating" = 'T' WHERE "content_rating" = 'E'`
  )
}

export async function down(): Promise<void> {}
