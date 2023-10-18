import { Type } from "decentraland-gatsby/dist/entities/Database/types"
import { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate"

export const shorthands: ColumnDefinitions | undefined = undefined

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("entities_places", {
    place_id: {
      type: Type.UUID,
      primaryKey: true,
    },
    entity_id: {
      type: Type.Text,
      primaryKey: true,
    },
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("entities_places", { cascade: true })
}
