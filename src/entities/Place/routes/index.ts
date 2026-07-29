import withCors from "decentraland-gatsby/dist/entities/Route/middleware/withCors"
import routes from "decentraland-gatsby/dist/entities/Route/wkc/routes"
import env from "decentraland-gatsby/dist/utils/env"

import { featurePlace, unfeaturePlace } from "./featured"
import { getPlace } from "./getPlace"
import { getPlaceCategories } from "./getPlaceCategories"
import { getPlaceList } from "./getPlaceList"
import { getPlaceListById } from "./getPlaceListById"
import { getPlaceStatusListById } from "./getPlaceStatusListById"
import { updateDisabled } from "./updateDisabled"
import { updateHighlight } from "./updateHighlight"
import { updateRanking } from "./updateRanking"
import { updateRating } from "./updateRating"
import { API_CORS_ORIGINS } from "../../shared/cors"

export const DECENTRALAND_URL = env("DECENTRALAND_URL", "")

export default routes((router) => {
  router.getRouter().use(
    withCors({
      corsOrigin: API_CORS_ORIGINS,
    })
  )
  router.get("/places/:place_id", getPlace)
  router.get("/places", getPlaceList)
  router.post("/places", getPlaceListById)
  router.put("/places/:place_id/rating", updateRating)
  router.put("/places/:place_id/ranking", updateRanking)
  router.put("/places/:place_id/highlight", updateHighlight)
  router.put("/places/:place_id/disable", updateDisabled)
  router.get("/places/:place_id/categories", getPlaceCategories)
  router.put("/places/:place_id/featured", featurePlace)
  router.delete("/places/:place_id/featured", unfeaturePlace)
  router.post("/places/status", getPlaceStatusListById)
}, {})
