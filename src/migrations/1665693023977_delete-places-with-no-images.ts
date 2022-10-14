import { MigrationBuilder } from "node-pg-migrate"

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.db.query(
    "DELETE FROM entities_places ep WHERE ep.place_id IN (SELECT id FROM places p WHERE p.image LIKE 'https://api.decentraland.org%')"
  )
  pgm.db.query(
    "DELETE FROM place_activities pa WHERE pa.place_id IN (SELECT id FROM places p WHERE p.image LIKE 'https://api.decentraland.org%')"
  )
  pgm.db.query(
    "DELETE FROM place_activity_daily pad2 WHERE pad2.place_id IN (SELECT id FROM places p WHERE p.image LIKE 'https://api.decentraland.org%')"
  )
  pgm.db.query(
    "DELETE FROM user_favorites uf WHERE uf.place_id IN (SELECT id FROM places p WHERE p.image LIKE 'https://api.decentraland.org%')"
  )
  pgm.db.query(
    "DELETE FROM user_likes ul WHERE ul.place_id IN (SELECT id FROM places p WHERE p.image LIKE 'https://api.decentraland.org%')"
  )
  pgm.db.query(
    "DELETE FROM places p WHERE p.image like 'https://api.decentraland.org%'"
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function down(pgm: MigrationBuilder): Promise<void> {}
