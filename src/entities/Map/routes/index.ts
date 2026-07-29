import routes from "decentraland-gatsby/dist/entities/Route/wkc/routes"
import env from "decentraland-gatsby/dist/utils/env"

import { getAllPlacesList } from "./getAllPlacesList"
import { getMapPlaces } from "./getMapPlaces"

export const DECENTRALAND_URL = env("DECENTRALAND_URL", "")

export default routes((router) => {
  router.get("/map", getMapPlaces)
  // This new endpoint will merge the places and worlds content
  router.get("/map/places", getAllPlacesList)
}, {})
