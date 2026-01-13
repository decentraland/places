import withCors from "decentraland-gatsby/dist/entities/Route/middleware/withCors"
import routes from "decentraland-gatsby/dist/entities/Route/wkc/routes"
import env from "decentraland-gatsby/dist/utils/env"

import { getDestinationsList } from "./getDestinationsList"
import { getUnifiedDestinationsList } from "./getUnifiedDestinationsList"

export const DECENTRALAND_URL = env("DECENTRALAND_URL", "")

export default routes((router) => {
  router.getRouter().use(
    withCors({
      corsOrigin: [
        /https?:\/\/localhost(:\d{4,6})?/,
        /https?:\/\/127\.0\.0\.1(:\d{4,6})?/,
        /https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d{4,6})?/,
        /https:\/\/([a-zA-Z0-9\-_]+\.)*dcl\.gg/,
        /https:\/\/([a-zA-Z0-9\-_]+\.)*decentraland\.systems/,
        /https:\/\/([a-zA-Z0-9\-_]+\.)*decentraland\.today/,
        /https:\/\/([a-zA-Z0-9\-_]+\.)*decentraland\.zone/,
        /https:\/\/([a-zA-Z0-9\-_]+\.)*decentraland\.org/,
        /https:\/\/decentraland\.github\.io/,
        /https:\/\/([a-zA-Z0-9\-_]+\.)*pages\.dev/,
        /https:\/\/([a-zA-Z0-9\-_])+-decentraland1\.vercel\.app/,
      ],
    })
  )
  router.get("/destinations", getDestinationsList)
  router.get("/destinations/unified", getUnifiedDestinationsList)
}, {})

