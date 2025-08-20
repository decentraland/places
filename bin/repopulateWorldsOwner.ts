#!/usr/bin/env ts-node

// eslint-disable-next-line import/order
import { writeFileSync } from "fs"

// Suppress verbose HTTP logs
process.env.LOG_LEVEL = "error"

// Suppress console.log and console.error from external libraries
const originalConsoleLog = console.log
const originalConsoleError = console.error

console.log = (...args: any[]) => {
  // Allow our logger messages and simple progress messages
  if (
    args[0] &&
    typeof args[0] === "string" &&
    (args[0].includes('{"level":"') ||
      args[0].includes("Starting worlds") ||
      args[0].includes("Database connection") ||
      args[0].includes("Processing batch") ||
      args[0].includes("Processing world") ||
      args[0].includes("Progress:") ||
      args[0].includes("Repopulation completed") ||
      args[0].includes("Database connection closed") ||
      args[0].includes("Failed to process world"))
  ) {
    originalConsoleLog(...args)
  }
}

console.error = (...args: any[]) => {
  // Allow our logger error messages
  if (
    args[0] &&
    typeof args[0] === "string" &&
    args[0].includes('{"level":"')
  ) {
    originalConsoleError(...args)
  }
}

// eslint-disable-next-line import/order
import { join } from "path"
import logger from "decentraland-gatsby/dist/entities/Development/logger"
import ContentServer from "decentraland-gatsby/dist/utils/api/ContentServer"
import fetch from "node-fetch"
import { Client } from "pg"

import { WorldAbout } from "../src/entities/CheckScenes/types"
import { PlaceAttributes } from "../src/entities/Place/types"

// Hardcoded database connection string - REPLACE WITH YOUR ACTUAL CONNECTION STRING
const DATABASE_CONNECTION_STRING =
  "postgres://places:CeD2O9GCbEevwJWto3yJCvOe@localhost:8020/places"

// DEV: "postgres://places:v6m14nMdj3Dvv6T9DFy6s6BX@localhost:8020/places"

// PRD: "postgres://places:CeD2O9GCbEevwJWto3yJCvOe@localhost:8020/places"

// Direct database client
let dbClient: Client | null = null

const WORLDS_CONTENT_SERVER_URL =
  "https://worlds-content-server.decentraland.org"

interface RepopulateWorldsOwnerOptions {
  dryRun?: boolean
  batchSize?: number
  delayMs?: number
}

interface WorldResult {
  worldId: string
  worldName: string
  success: boolean
  reason: string
  owner?: string
  error?: string
}

// Initialize database connection
async function initializeDatabase(): Promise<void> {
  try {
    logger.log("Initializing database connection...")

    // Create direct PostgreSQL client
    dbClient = new Client({
      connectionString: DATABASE_CONNECTION_STRING,
    })

    // Connect to database
    await dbClient.connect()

    // Log the connection string being used (masked)
    const maskedConnection = DATABASE_CONNECTION_STRING.replace(
      /:[^:@]*@/,
      ":****@"
    )
    logger.log(`Using connection string: ${maskedConnection}`)

    // Test the connection with a query to count worlds with null owners
    const result = await dbClient.query(
      "SELECT COUNT(*) as count FROM places WHERE world = true AND disabled = false AND owner IS NULL"
    )

    logger.log(
      `Database connection successful. Found ${
        result.rows[0]?.count || 0
      } worlds with null owners to process.`
    )
  } catch (error) {
    logger.error("Failed to initialize database", { error })
    console.error("Full error details:", error)
    throw error
  }
}

function extractEntityIdFromScenesUrn(scenesUrn: string): string | null {
  const match = scenesUrn.match(/urn:decentraland:entity:([^?]+)/)
  return match ? match[1] : null
}

async function getWorldAbout(worldName: string): Promise<WorldAbout | null> {
  try {
    const worldContentServer = ContentServer.getInstanceFrom(
      WORLDS_CONTENT_SERVER_URL
    )
    const response = await worldContentServer.fetch(`/world/${worldName}/about`)
    return response as WorldAbout
  } catch (error: any) {
    // Only log if it's not a 404 (expected for worlds with no scenes)
    if (error?.statusCode !== 404) {
      logger.error(`Failed to get world about for ${worldName}`, { error })
    }
    return null
  }
}

async function getContentEntityByPointer(
  worldName: string
): Promise<any | null> {
  try {
    const url = `${WORLDS_CONTENT_SERVER_URL}/entities/active`
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "places-repopulator-script",
      },
      body: JSON.stringify({ pointers: [worldName] }),
    })
    if (!response.ok) {
      if (response.status !== 404) {
        logger.error(`Failed to get content entity for pointer ${worldName}`, {
          status: response.status,
        })
      }
      return null
    }
    const entities = await response.json()
    return entities[0] || null
  } catch (error) {
    logger.error(`Failed to get content entity for pointer ${worldName}`, {
      error,
    })
    return null
  }
}

async function getWorldsWithNullOwners(
  limit = 100,
  offset = 0
): Promise<PlaceAttributes[]> {
  try {
    if (!dbClient) {
      throw new Error("Database client not initialized")
    }

    // Use direct SQL query to get worlds with null owners
    const query = `
      SELECT p.*
      FROM places p
      WHERE p.world is true 
        AND p.disabled is false 
        AND p.owner IS NULL
      ORDER BY p.created_at ASC
      LIMIT $1 OFFSET $2
    `

    const result = await dbClient.query(query, [limit, offset])

    return result.rows as PlaceAttributes[]
  } catch (error) {
    logger.error("Failed to get worlds with null owners", { error })
    console.error("Full error details:", error)
    return []
  }
}

async function updateWorldOwner(
  worldId: string,
  owner: string,
  dryRun = false
): Promise<boolean> {
  try {
    if (dryRun) {
      logger.log(`[DRY RUN] Would update world ${worldId} with owner ${owner}`)
      return true
    }

    if (!dbClient) {
      throw new Error("Database client not initialized")
    }

    const query = "UPDATE places SET owner = $1 WHERE id = $2"
    await dbClient.query(query, [owner, worldId])

    logger.log(`Updated world ${worldId} with owner ${owner}`)
    return true
  } catch (error) {
    logger.error(`Failed to update world ${worldId} with owner ${owner}`, {
      error,
    })
    return false
  }
}

async function processWorld(
  world: PlaceAttributes,
  dryRun = false,
  counters: {
    noSceneCount: number
    noEntityCount: number
    noOwnerCount: number
  }
): Promise<WorldResult> {
  try {
    // world_name is guaranteed to be not null due to SQL filter
    const worldName = world.world_name!
    const worldAbout = await getWorldAbout(worldName)
    if (!worldAbout || !worldAbout.configurations.scenesUrn.length) {
      counters.noSceneCount++
      return {
        worldId: world.id,
        worldName,
        success: false,
        reason: "no_scene",
      }
    }

    // Use pointer name instead of entityId
    const contentEntity = await getContentEntityByPointer(worldName)
    if (!contentEntity || !contentEntity.entity?.metadata) {
      counters.noEntityCount++
      return {
        worldId: world.id,
        worldName,
        success: false,
        reason: "no_content_entity",
      }
    }

    const owner = contentEntity.entity.metadata.owner
    if (!owner) {
      counters.noOwnerCount++
      return {
        worldId: world.id,
        worldName,
        success: false,
        reason: "no_owner",
      }
    }

    logger.log(`Processing world: ${worldName} -> owner: ${owner}`)
    const success = await updateWorldOwner(world.id, owner, dryRun)

    if (success) {
      return {
        worldId: world.id,
        worldName,
        success: true,
        reason: "success",
        owner,
      }
    } else {
      return {
        worldId: world.id,
        worldName,
        success: false,
        reason: "update_failed",
        owner,
      }
    }
  } catch (error) {
    logger.error(`Failed to process world ${world.world_name}`, { error })
    return {
      worldId: world.id,
      worldName: world.world_name!,
      success: false,
      reason: "error",
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function repopulateWorldsOwner(
  options: RepopulateWorldsOwnerOptions = {}
): Promise<void> {
  const { dryRun = false, batchSize = 10, delayMs = 1000 } = options

  logger.log(`Starting worlds owner repopulation (dry run: ${dryRun})`)

  // Initialize database connection
  await initializeDatabase()

  let processedCount = 0
  let successCount = 0
  const counters = {
    noSceneCount: 0,
    noEntityCount: 0,
    noOwnerCount: 0,
  }
  const results: WorldResult[] = []
  let offset = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const worlds = await getWorldsWithNullOwners(batchSize, offset)

    if (worlds.length === 0) {
      logger.log("No more worlds with null owners found")
      break
    }

    logger.log(
      `Processing batch ${Math.floor(offset / batchSize) + 1}: ${
        worlds.length
      } worlds`
    )

    for (const world of worlds) {
      const result = await processWorld(world, dryRun, counters)
      results.push(result)
      processedCount++
      if (result.success) successCount++

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }

    offset += batchSize
    logger.log(
      `Progress: ${processedCount} processed, ${successCount} successful, ${counters.noSceneCount} no scene, ${counters.noEntityCount} no entity, ${counters.noOwnerCount} no owner`
    )
  }

  logger.log(
    `Repopulation completed. Total processed: ${processedCount}, Successful: ${successCount}`
  )
  logger.log(
    `Summary: ${counters.noSceneCount} worlds with no scene, ${counters.noEntityCount} worlds with no entity, ${counters.noOwnerCount} worlds with no owner`
  )

  // Write detailed report to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const filename = `worlds-owner-repopulate-${
    dryRun ? "dry-run" : "results"
  }-${timestamp}.json`
  const filepath = join(__dirname, filename)

  const report = {
    summary: {
      totalProcessed: processedCount,
      successful: successCount,
      failed: processedCount - successCount,
      breakdown: {
        noScene: counters.noSceneCount,
        noEntity: counters.noEntityCount,
        noOwner: counters.noOwnerCount,
      },
    },
    results: results,
  }

  writeFileSync(filepath, JSON.stringify(report, null, 2))
  logger.log(`Detailed report written to: ${filepath}`)

  // Close database connection
  if (dbClient) {
    await dbClient.end()
    logger.log("Database connection closed")
  }
}

async function main() {
  const args = process.argv.slice(2)
  const options: RepopulateWorldsOwnerOptions = {
    dryRun: args.includes("--dry-run"),
    batchSize: parseInt(
      args.find((arg) => arg.startsWith("--batch-size="))?.split("=")[1] || "10"
    ),
    delayMs: parseInt(
      args.find((arg) => arg.startsWith("--delay="))?.split("=")[1] || "1000"
    ),
  }

  if (args.includes("--help")) {
    console.log(`
Usage: ts-node bin/repopulateWorldsOwner.ts [options]

Options:
  --dry-run              Run without making database changes
  --batch-size=N         Number of worlds to process in each batch (default: 10)
  --delay=N              Delay in milliseconds between API requests (default: 1000)
  --help                 Show this help message

Examples:
  ts-node bin/repopulateWorldsOwner.ts --dry-run
  ts-node bin/repopulateWorldsOwner.ts --batch-size=5 --delay=2000
`)
    return
  }

  try {
    await repopulateWorldsOwner(options)
  } catch (error) {
    logger.error("Repopulation failed", { error })
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

export { repopulateWorldsOwner }
