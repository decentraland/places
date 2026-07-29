import routes from "decentraland-gatsby/dist/entities/Route/wkc/routes"
import env from "decentraland-gatsby/dist/utils/env"

import { featureWorld, unfeatureWorld } from "./featured"
import { getWorld } from "./getWorld"
import { getWorldList } from "./getWorldList"
import { getWorldNamesList } from "./getWorldNamesList"
import { updateWorldFavorites } from "./updateWorldFavorites"
import { updateWorldHighlight } from "./updateWorldHighlight"
import { updateWorldLikes } from "./updateWorldLikes"
import { updateWorldRanking } from "./updateWorldRanking"
import { updateWorldRating } from "./updateWorldRating"

export const DECENTRALAND_URL = env("DECENTRALAND_URL", "")

export default routes((router) => {
  router.get("/worlds/:world_id", getWorld)
  router.get("/worlds", getWorldList)
  router.get("/world_names", getWorldNamesList)
  router.patch("/worlds/:world_id/favorites", updateWorldFavorites)
  router.patch("/worlds/:world_id/likes", updateWorldLikes)
  router.put("/worlds/:world_id/highlight", updateWorldHighlight)
  router.put("/worlds/:world_id/ranking", updateWorldRanking)
  router.put("/worlds/:world_id/rating", updateWorldRating)
  router.put("/worlds/:world_id/featured", featureWorld)
  router.delete("/worlds/:world_id/featured", unfeatureWorld)
}, {})
