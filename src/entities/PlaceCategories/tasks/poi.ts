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
  logger.log("> Processing new PoIs")
  const categorizedPlaces = await PlaceModel.findEnabledByCategory("poi")
  logger.log(
    `> Processing new PoIs > categorized places ${categorizedPlaces.length}`
  )
  const poiPlaces = await PlaceModel.findEnabledByPositions(pois)
  logger.log(`> Processing new PoIs > poi Places ${poiPlaces.length}`)

  // Places to be removed from POI category
  const toBeRemoved = []
  for (const categorizedPlace of categorizedPlaces) {
    if (!poiPlaces.find((place) => place.id === categorizedPlace.id)) {
      toBeRemoved.push(categorizedPlace)
    }
  }

  // Places to be added to POI Category
  const toBeAdded = []
  for (const poiPlace of poiPlaces) {
    if (!categorizedPlaces.find((place) => place.id === poiPlace.id)) {
      toBeAdded.push([poiPlace.id, "poi"])
    }
  }

  logger.log(`> Processing new PoIs > to be removed ${toBeRemoved.length}`)

  for (const removable of toBeRemoved) {
    logger.log(`> Processing new PoIs > removing: ${removable.id}`)
    await PlaceCategories.removeCategoryFromPlace(removable.id, "poi")
    const currentCategories = await PlaceCategories.findCategoriesByPlaceId(
      removable.id
    )
    await PlaceModel.overrideCategories(
      removable.id,
      currentCategories.map(({ category_id }) => category_id)
    )
  }

  logger.log(`> Processing new PoIs > to be added ${toBeAdded.length}`)

  if (toBeAdded.length) {
    await PlaceCategories.addCategoriesToPlaces(toBeAdded)
    for (const [placeId] of toBeAdded) {
      const currentCategories = await PlaceCategories.findCategoriesByPlaceId(
        placeId
      )

      await PlaceModel.overrideCategories(
        placeId,
        currentCategories.map(({ category_id }) => category_id)
      )
    }
  }

  logger.log("> Processing new PoIs > processed succesffully!")
}
