import { Logger } from "decentraland-gatsby/dist/entities/Development/logger"
import { Task } from "decentraland-gatsby/dist/entities/Task"

import { getPois } from "../../../modules/pois"
import PlaceModel from "../../Place/model"
import PlaceCategories from "../model"

export const checkPoisForCategoryUpdate = new Task({
  name: "places_poi_category_update",
  repeat: Task.Repeat.Weekly,
  task: async (ctx) => {
    const pois = await getPois()
    await processNewPois(pois, ctx.logger)
  },
})

const processNewPois = async (pois: string[], logger: Logger) => {
  const categorizedPlaces = await PlaceModel.findEnabledByCategory("poi")
  logger.log(
    "> Processing new Pois > categorized places",
    categorizedPlaces.length as any
  )
  const poiPlaces = await PlaceModel.findEnabledByPositions(pois)
  logger.log("> Processing new Pois > poi Places", poiPlaces.length as any)

  // Places to be removed from POI category
  const toBeRemoved = []
  for (const categorizedPlace of categorizedPlaces) {
    if (!poiPlaces.find((place) => place.id === categorizedPlace.id)) {
      toBeRemoved.push(categorizedPlace)
    }
  }

  logger.log("> Processing new Pois > to be removed", toBeRemoved.length as any)

  // Places to be added to POI Category
  const toBeAdded = []
  for (const poiPlace of poiPlaces) {
    if (!categorizedPlaces.find((place) => place.id === poiPlace.id)) {
      toBeAdded.push([poiPlace.id, "poi"])
    }
  }

  logger.log("> Processing new Pois > to be added", toBeAdded.length as any)

  for (const removable of toBeRemoved) {
    logger.log("> Processing new Pois > removing: ", removable.id as any)
    await PlaceCategories.removeCategoryFromPlace(removable.id, "poi")
  }

  await PlaceCategories.addCategoriesToPlaces(toBeAdded)

  logger.log("> Processing new Pois > processed succesffully!")
}
