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

  const returnedData = await PlaceModel.updateIndexWorlds(worldsVerified)

  loggerExtended.log(`Worlds updated ${returnedData}`)
}
