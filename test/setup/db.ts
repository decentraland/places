import database from "decentraland-gatsby/dist/entities/Database/database"

const TABLES_TO_CLEAN = [
  "place_content_rating",
  "place_categories",
  "place_positions",
  "check_scenes",
  "places",
  "worlds",
  "categories",
]

/**
 * Initializes the test database connection using the CONNECTION_STRING
 * environment variable (same mechanism as production code).
 */
export async function initTestDb(): Promise<void> {
  await database.connect()
}

/**
 * Truncates all relevant tables to ensure test isolation.
 * Uses CASCADE to handle foreign key constraints.
 */
export async function cleanTables(): Promise<void> {
  for (const table of TABLES_TO_CLEAN) {
    await database.query(`TRUNCATE TABLE ${table} CASCADE`)
  }
}

/**
 * Closes the database connection pool.
 */
export async function closeTestDb(): Promise<void> {
  await database.close()
}
