import { resolve } from "path"

import { databaseInitializer } from "decentraland-gatsby/dist/entities/Database/utils"
import metrics from "decentraland-gatsby/dist/entities/Prometheus/routes"
import RequestError from "decentraland-gatsby/dist/entities/Route/error"
import handle from "decentraland-gatsby/dist/entities/Route/handle"
import {
  withBody,
  withCors,
  withDDosProtection,
  withLogs,
} from "decentraland-gatsby/dist/entities/Route/middleware"
import { status } from "decentraland-gatsby/dist/entities/Route/routes"
import gatsby from "decentraland-gatsby/dist/entities/Route/routes/filesystem2/gatsby"
import { initializeServices } from "decentraland-gatsby/dist/entities/Server/handler"
import { serverInitializer } from "decentraland-gatsby/dist/entities/Server/utils"
import {
  taskInitializer,
  default as tasksManager,
} from "decentraland-gatsby/dist/entities/Task"
import express from "express"

import categoryRoute from "./entities/Category/routes"
import placeRoute from "./entities/Place/routes"
import socialRoutes from "./entities/Social/routes"
import userFavoriteRoute from "./entities/UserFavorite/routes"
import userLikesRoute from "./entities/UserLikes/routes"

const tasks = tasksManager()

const app = express()
app.set("x-powered-by", false)
app.use(withLogs())
app.use("/api", [
  withDDosProtection(),
  withCors(),
  withBody(),
  categoryRoute,
  userFavoriteRoute,
  userLikesRoute,
  placeRoute,
  status(),
  handle(async () => {
    throw new RequestError("NotFound", RequestError.NotFound)
  }),
])

app.use(metrics)
app.use(socialRoutes)
app.use(
  gatsby(resolve(__filename, "../../public"), {
    contentSecurityPolicy: {
      scriptSrc: [
        "https://decentraland.org",
        "https://*.decentraland.org",
        "https://connect.facebook.net",
        "http://*.hotjar.com:*",
        "https://*.hotjar.com:*",
        "http://*.hotjar.io",
        "https://*.hotjar.io",
        "wss://*.hotjar.com",
        "https://*.twitter.com",
        "https://cdn.segment.com",
        "https://cdn.rollbar.com",
        "https://ajax.cloudflare.com",
        "https://googleads.g.doubleclick.net",
        "https://ssl.google-analytics.com",
        "https://tagmanager.google.com",
        "https://www.google-analytics.com",
        "https://www.google-analytics.com",
        "https://www.google.com",
        "https://www.googleadservices.com",
        "https://www.googletagmanager.com",
      ].join(" "),
    },
  })
)

initializeServices([
  databaseInitializer(),
  taskInitializer(tasks),
  serverInitializer(app, process.env.PORT, process.env.HOST),
])
