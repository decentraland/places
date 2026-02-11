/**
 * One-time script to populate the SDK column for places and worlds
 *
 * This script will:
 * 1. Query all places/worlds with null SDK values
 * 2. Fetch entity scenes from Catalyst (for places) or Worlds Content Server (for worlds)
 * 3. Extract the runtimeVersion from scene.json
 * 4. Update the SDK column in the database
 *
 * Usage by environment:
 *   npm run populate:sdk:dev [options]   # Development
 *   npm run populate:sdk:stg [options]   # Staging
 *   npm run populate:sdk:prd [options]   # Production
 *
 * Options:
 *   --dry-run    Preview changes without updating the database
 *   --limit N    Limit the number of records to process (default: all)
 *   --places     Only process places (Genesis City)
 *   --worlds     Only process worlds
 *
 * Examples:
 *   npm run populate:sdk:dev -- --dry-run --limit 10
 *   npm run populate:sdk:stg -- --dry-run
 *   npm run populate:sdk:prd -- --places
 */

import logger from "decentraland-gatsby/dist/entities/Development/logger"
import Catalyst from "decentraland-gatsby/dist/utils/api/Catalyst"
import { ContentEntityScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import env from "decentraland-gatsby/dist/utils/env"
import fetch from "node-fetch"
import { Pool } from "pg"

// Configuration
const BATCH_SIZE = 50 // Number of places to process in each batch
const DELAY_BETWEEN_BATCHES_MS = 1000 // Delay between batches to avoid rate limiting

interface PlaceRecord {
  id: string
  base_position: string | null
  world: boolean
  world_name: string | null
}

interface SceneJson {
  runtimeVersion?: string
}

/**
 * Extract runtimeVersion from scene.json content
 */
async function fetchSceneJsonFromContent(
  contentServerUrl: string,
  contentEntityScene: ContentEntityScene
): Promise<string | null> {
  try {
    const sceneJsonContent = contentEntityScene.content.find(
      (content) => content.file === "scene.json"
    )

    if (!sceneJsonContent) {
      return null
    }

    const contentUrl = `${contentServerUrl.replace(/\/+$/, "")}/contents/${
      sceneJsonContent.hash
    }`
    const response = await fetch(contentUrl)

    if (!response.ok) {
      return null
    }

    const sceneJson: SceneJson = await response.json()
    return sceneJson.runtimeVersion || null
  } catch (error) {
    return null
  }
}

/**
 * Fetch runtimeVersion for a world from the Worlds Content Server
 */
async function fetchWorldRuntimeVersion(
  worldsContentServerUrl: string,
  worldName: string
): Promise<string | null> {
  try {
    // First, get the world's entity info
    const entityUrl = `${worldsContentServerUrl}/world/${worldName}/about`
    const aboutResponse = await fetch(entityUrl)

    if (!aboutResponse.ok) {
      return null
    }

    const aboutData = (await aboutResponse.json()) as {
      configurations?: { scenesUrn?: string[] }
    }
    const scenesUrn = aboutData?.configurations?.scenesUrn?.[0]

    if (!scenesUrn) {
      return null
    }

    // Extract entity ID from URN (format: urn:decentraland:entity:bafk...)
    const entityIdMatch = scenesUrn.match(/urn:decentraland:entity:(.+)/)
    if (!entityIdMatch) {
      return null
    }

    const entityId = entityIdMatch[1]

    // Fetch the entity content
    const contentUrl = `${worldsContentServerUrl}/contents/${entityId}`
    const contentResponse = await fetch(contentUrl)

    if (!contentResponse.ok) {
      return null
    }

    const entityData = (await contentResponse.json()) as ContentEntityScene

    // Find scene.json in content
    const sceneJsonContent = entityData.content?.find(
      (content: { file: string }) => content.file === "scene.json"
    )

    if (!sceneJsonContent) {
      return null
    }

    // Fetch scene.json
    const sceneJsonUrl = `${worldsContentServerUrl}/contents/${sceneJsonContent.hash}`
    const sceneJsonResponse = await fetch(sceneJsonUrl)

    if (!sceneJsonResponse.ok) {
      return null
    }

    const sceneJson: SceneJson = await sceneJsonResponse.json()
    return sceneJson.runtimeVersion || null
  } catch (error) {
    logger.error(`Error fetching world ${worldName}:`, error as any)
    return null
  }
}

/**
 * Process places in batches
 */
async function processPlaces(
  pool: Pool,
  places: PlaceRecord[],
  dryRun: boolean
): Promise<{ updated: number; failed: number; skipped: number }> {
  let updated = 0
  let failed = 0
  let skipped = 0

  const catalyst = Catalyst.getInstance()
  const catalystUrl = env("CATALYST_URL", "https://peer.decentraland.org")
  const contentServerUrl = `${catalystUrl.replace(/\/+$/, "")}/content`

  // Process in batches
  for (let i = 0; i < places.length; i += BATCH_SIZE) {
    const batch = places.slice(i, i + BATCH_SIZE)
    const pointers = batch.map((p) => p.base_position!).filter(Boolean)

    logger.log(
      `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
        places.length / BATCH_SIZE
      )} (${pointers.length} places)`
    )

    try {
      // Fetch entity scenes for all pointers in batch
      const entityScenes = await catalyst.getEntityScenes(pointers)

      // Create a map of pointer -> entity scene
      const entityMap = new Map<string, ContentEntityScene>()
      for (const entity of entityScenes) {
        for (const pointer of entity.pointers) {
          entityMap.set(pointer, entity)
        }
      }

      // Process each place in the batch
      for (const place of batch) {
        if (!place.base_position) {
          skipped++
          continue
        }

        const entity = entityMap.get(place.base_position)
        if (!entity) {
          logger.log(`  No entity found for ${place.base_position}`)
          skipped++
          continue
        }

        const runtimeVersion = await fetchSceneJsonFromContent(
          contentServerUrl,
          entity
        )

        if (runtimeVersion) {
          logger.log(`  ${place.base_position}: SDK ${runtimeVersion}`)

          if (!dryRun) {
            await pool.query("UPDATE places SET sdk = $1 WHERE id = $2", [
              runtimeVersion,
              place.id,
            ])
          }
          updated++
        } else {
          logger.log(`  ${place.base_position}: No runtimeVersion found`)
          failed++
        }
      }
    } catch (error) {
      logger.error(`Error processing batch:`, error as any)
      failed += batch.length
    }

    // Delay between batches
    if (i + BATCH_SIZE < places.length) {
      await new Promise((resolve) =>
        setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS)
      )
    }
  }

  return { updated, failed, skipped }
}

/**
 * Process worlds
 */
async function processWorlds(
  pool: Pool,
  worlds: PlaceRecord[],
  dryRun: boolean,
  worldsContentServerUrl: string
): Promise<{ updated: number; failed: number; skipped: number }> {
  let updated = 0
  let failed = 0
  let skipped = 0

  for (let i = 0; i < worlds.length; i++) {
    const world = worlds[i]

    if (!world.world_name) {
      skipped++
      continue
    }

    logger.log(
      `Processing world ${i + 1}/${worlds.length}: ${world.world_name}`
    )

    const runtimeVersion = await fetchWorldRuntimeVersion(
      worldsContentServerUrl,
      world.world_name
    )

    if (runtimeVersion) {
      logger.log(`  ${world.world_name}: SDK ${runtimeVersion}`)

      if (!dryRun) {
        await pool.query("UPDATE places SET sdk = $1 WHERE id = $2", [
          runtimeVersion,
          world.id,
        ])
      }
      updated++
    } else {
      logger.log(`  ${world.world_name}: No runtimeVersion found`)
      failed++
    }

    // Small delay between requests
    if (i < worlds.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  return { updated, failed, skipped }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const onlyPlaces = args.includes("--places")
  const onlyWorlds = args.includes("--worlds")

  const limitIndex = args.indexOf("--limit")
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : null

  // Determine environment from DOTENV_CONFIG_PATH
  const envPath = process.env.DOTENV_CONFIG_PATH || ".env.development"
  const envName = envPath.includes("prd")
    ? "PRODUCTION"
    : envPath.includes("stg")
    ? "STAGING"
    : "DEVELOPMENT"

  const catalystUrl = env("CATALYST_URL", "https://peer.decentraland.org")
  const worldsContentServerUrl = env(
    "WORLDS_CONTENT_SERVER_URL",
    "https://worlds-content-server.decentraland.org"
  )

  logger.log("=".repeat(60))
  logger.log("SDK Population Script")
  logger.log("=".repeat(60))
  logger.log(`Environment: ${envName}`)
  logger.log(`Catalyst URL: ${catalystUrl}`)
  logger.log(`Worlds Content Server: ${worldsContentServerUrl}`)
  logger.log(`Mode: ${dryRun ? "DRY RUN (no changes will be made)" : "LIVE"}`)
  logger.log(`Limit: ${limit || "No limit"}`)
  logger.log(
    `Processing: ${
      onlyPlaces
        ? "Places only"
        : onlyWorlds
        ? "Worlds only"
        : "Both places and worlds"
    }`
  )
  logger.log("=".repeat(60))

  // Connect to database
  const connectionString = process.env.CONNECTION_STRING
  if (!connectionString) {
    throw new Error("CONNECTION_STRING environment variable is required")
  }

  const pool = new Pool({ connectionString })

  try {
    // Query places with null SDK
    let placesQuery = `
      SELECT id, base_position, world, world_name
      FROM places
      WHERE sdk IS NULL AND disabled = false
    `

    if (onlyPlaces) {
      placesQuery += " AND world = false"
    } else if (onlyWorlds) {
      placesQuery += " AND world = true"
    }

    placesQuery += " ORDER BY created_at DESC"

    if (limit) {
      placesQuery += ` LIMIT ${limit}`
    }

    const result = await pool.query<PlaceRecord>(placesQuery)
    const records = result.rows

    logger.log(`Found ${records.length} records with null SDK`)

    const places = records.filter((r) => !r.world)
    const worlds = records.filter((r) => r.world)

    logger.log(`  - Places (Genesis City): ${places.length}`)
    logger.log(`  - Worlds: ${worlds.length}`)
    logger.log("")

    let totalUpdated = 0
    let totalFailed = 0
    let totalSkipped = 0

    // Process places
    if (places.length > 0 && !onlyWorlds) {
      logger.log("Processing Places...")
      logger.log("-".repeat(40))
      const placesResult = await processPlaces(pool, places, dryRun)
      totalUpdated += placesResult.updated
      totalFailed += placesResult.failed
      totalSkipped += placesResult.skipped
      logger.log("")
    }

    // Process worlds
    if (worlds.length > 0 && !onlyPlaces) {
      logger.log("Processing Worlds...")
      logger.log("-".repeat(40))
      const worldsResult = await processWorlds(
        pool,
        worlds,
        dryRun,
        worldsContentServerUrl
      )
      totalUpdated += worldsResult.updated
      totalFailed += worldsResult.failed
      totalSkipped += worldsResult.skipped
      logger.log("")
    }

    // Summary
    logger.log("=".repeat(60))
    logger.log("Summary")
    logger.log("=".repeat(60))
    logger.log(`Total processed: ${records.length}`)
    logger.log(`  - Updated: ${totalUpdated}`)
    logger.log(`  - Failed: ${totalFailed}`)
    logger.log(`  - Skipped: ${totalSkipped}`)

    if (dryRun) {
      logger.log("")
      logger.log("This was a dry run. No changes were made to the database.")
      logger.log("Run without --dry-run to apply changes.")
    }
  } finally {
    await pool.end()
  }
}

// Run the script
main().catch((error) => {
  logger.error("Script failed:", error)
  process.exit(1)
})
