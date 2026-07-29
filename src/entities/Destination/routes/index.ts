import routes from "decentraland-gatsby/dist/entities/Route/wkc/routes"
import env from "decentraland-gatsby/dist/utils/env"

import { getDestinationsList } from "./getDestinationsList"
import { getDestinationsListById } from "./getDestinationsListById"

export const DECENTRALAND_URL = env("DECENTRALAND_URL", "")

export default routes((router) => {
  router.get("/destinations", getDestinationsList)
  router.post("/destinations", getDestinationsListById)
}, {})
