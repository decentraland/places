import { Logger } from "decentraland-gatsby/dist/entities/Development/logger"

import PlaceModel from "../../Place/model"
import { verifyWorldsIndexing } from "./verifyWorldsIndexing"

export async function proceessWorldsIndexing(logger: Logger) {
  const worlds = await PlaceModel.findWorlds()
  const worldNames = worlds
    .map((world) => world.world_name)
    .filter((worldName) => worldName !== null) as string[]

  const loggerExtended = logger.extend({
    worlds: worldNames.length,
  })

  const worldsVerified = await verifyWorldsIndexing(worldNames)

  loggerExtended.log(
    `Should index ${worldsVerified.indexNames.length} - Should not index ${worldsVerified.nonIndexNames.length}`
  )

  if (worldsVerified.hasIndexNames) {
    const updateWorlds = await PlaceModel.updateWorldsShown(
      worldsVerified.indexNames
    )
    loggerExtended.log(`Worlds updated to show ${updateWorlds}`)
  }

  if (worldsVerified.hasNonIndexNames) {
    const updateWorlds = await PlaceModel.updateWorldsHidden(
      worldsVerified.nonIndexNames
    )
    loggerExtended.log(`Worlds updated to hide ${updateWorlds}`)
  }
}
