/* eslint-disable @typescript-eslint/naming-convention */
import { SQL, table } from "decentraland-gatsby/dist/entities/Database/utils"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import PlaceModel from "../entities/Place/model"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.db.query(
    SQL`UPDATE ${table(PlaceModel)} SET like_rate = NULL WHERE like_rate = 0`
  )
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.db.query(
    SQL`UPDATE ${table(PlaceModel)} SET like_rate = 0 WHERE like_rate IS NULL`
  )
}
