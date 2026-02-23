import RequestError from "decentraland-gatsby/dist/entities/Route/error"
import handle from "decentraland-gatsby/dist/entities/Route/handle"
import {
  withBody,
  withCors,
} from "decentraland-gatsby/dist/entities/Route/middleware"
import express from "express"

import categoryRoute from "../../src/entities/Category/routes"
import destinationRoute from "../../src/entities/Destination/routes"
import placeRoute from "../../src/entities/Place/routes"
import userFavoriteRoute from "../../src/entities/UserFavorite/routes"
import userLikesRoute from "../../src/entities/UserLikes/routes"
import worldRoute from "../../src/entities/World/routes"

/**
 * Creates a lightweight Express app with the API routes mounted,
 * without background tasks or the HTTP listener.
 * Suitable for use with supertest in integration tests.
 */
export function createTestApp(): express.Express {
  const app = express()
  app.set("x-powered-by", false)
  app.use("/api", [
    withCors({
      corsOrigin: [/^http:\/\/localhost:[0-9]{1,10}$/],
      allowedHeaders: "*",
    }),
    withBody(),
    categoryRoute,
    destinationRoute,
    userFavoriteRoute,
    userLikesRoute,
    placeRoute,
    worldRoute,
    handle(async () => {
      throw new RequestError("NotFound", RequestError.NotFound)
    }),
  ])
  return app
}
