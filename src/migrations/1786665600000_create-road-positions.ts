import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

import RoadPositionModel from "../entities/RoadPosition/model"

export const shorthands: ColumnDefinitions | undefined = undefined

const INSERT_CHUNK = 1000

/**
 * A lookup table of Genesis City road parcels, so the destinations feed can exclude roads by
 * `base_position` with an indexed probe. Roads register as ordinary places with the Foundation as
 * their contact, so no place column identifies them; the map does, and this is its road list.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(RoadPositionModel.tableName, {
    position: {
      primaryKey: true,
      type: Type.Varchar(15),
      notNull: true,
    },
  })

  const { default: roads } = (await import(
    "../__data__/RoadCoordinates.json"
  )) as { default: string[] }

  const unique = Array.from(new Set(roads))
  for (let i = 0; i < unique.length; i += INSERT_CHUNK) {
    const rows = unique
      .slice(i, i + INSERT_CHUNK)
      .map((position) => `('${position.replace(/'/g, "''")}')`)
      .join(",")
    pgm.sql(
      `INSERT INTO ${RoadPositionModel.tableName} (position) VALUES ${rows} ON CONFLICT DO NOTHING`
    )
  }
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(RoadPositionModel.tableName, { cascade: true })
}
