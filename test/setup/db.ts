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
 * Validates that the current environment is safe for destructive database operations.
 * Requires NODE_ENV=test and a local CONNECTION_STRING to prevent accidental
 * data loss in production.
 */
function assertTestEnvironment(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "Refused to run: NODE_ENV is not 'test'. " +
        "Set NODE_ENV=test to use the test database helpers."
    )
  }

  const connectionString = process.env.CONNECTION_STRING || ""
  const isLocalConnection =
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1")

  if (!isLocalConnection) {
    throw new Error(
      "Refused to run: CONNECTION_STRING is not a local database. " +
        "Use a localhost or 127.0.0.1 connection for tests."
    )
  }
}

/**
 * Initializes the test database connection using the CONNECTION_STRING
 * environment variable (same mechanism as production code).
 * Validates that the environment is safe before connecting.
 */
export async function initTestDb(): Promise<void> {
  assertTestEnvironment()
  await database.connect()
}

/**
 * Truncates all relevant tables to ensure test isolation.
 * Uses CASCADE to handle foreign key constraints.
 * Validates that the environment is safe before truncating.
 */
export async function cleanTables(): Promise<void> {
  assertTestEnvironment()
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
