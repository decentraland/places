import { Logger } from "decentraland-gatsby/dist/entities/Development/logger"
import { Task } from "decentraland-gatsby/dist/entities/Task"
import { diff } from "radash"

import { getPois } from "../../../modules/pois"
import { DecentralandCategories } from "../../Category/types"
import PlaceModel from "../../Place/model"
import PlaceCategories from "../model"

export const checkPoisForCategoryUpdate = new Task({
  name: "places_poi_category_update",
  repeat: Task.Repeat.Daily,
  task: async (ctx) => {
    const pois = await getPois()
    await processNewPois(pois, ctx.logger)
  },
})

const processNewPois = async (pois: string[], logger: Logger) => {
  logger.log("> Processing new PoIs")
  const categorizedPlaces = await PlaceModel.findEnabledByCategory(
    DecentralandCategories.POI
  )
  logger.log(
    `> Processing new PoIs > categorized places ${categorizedPlaces.length}`
  )
  const poiPlaces = await PlaceModel.findEnabledByPositions(pois)
  logger.log(`> Processing new PoIs > poi Places ${poiPlaces.length}`)

  // Places to be removed from POI category
  const toBeRemoved = diff(categorizedPlaces, poiPlaces)

  // Places to be added to POI Category
  const toBeAdded = diff(poiPlaces, categorizedPlaces).map((poiPlace) => [
    poiPlace.id,
    DecentralandCategories.POI,
  ])

  logger.log(`> Processing new PoIs > to be removed ${toBeRemoved.length}`)

  // TODO: review, reduce queries?
  for (const removable of toBeRemoved) {
    logger.log(`> Processing new PoIs > removing: ${removable.id}`)
    await PlaceCategories.removeCategoryFromPlace(
      removable.id,
      DecentralandCategories.POI
    )
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
