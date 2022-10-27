import { databaseInitializer } from "decentraland-gatsby/dist/entities/Database/utils"
// import manager from 'decentraland-gatsby/dist/entities/Job/index'
// import { jobInitializer } from 'decentraland-gatsby/dist/entities/Job/utils'
import metrics from "decentraland-gatsby/dist/entities/Prometheus/routes"
import RequestError from "decentraland-gatsby/dist/entities/Route/error"
import handle from "decentraland-gatsby/dist/entities/Route/handle"
import {
  withBody,
  withCors,
  withDDosProtection,
  withLogs,
} from "decentraland-gatsby/dist/entities/Route/middleware"
import {
  filesystem,
  status,
} from "decentraland-gatsby/dist/entities/Route/routes"
import { initializeServices } from "decentraland-gatsby/dist/entities/Server/handler"
import { serverInitializer } from "decentraland-gatsby/dist/entities/Server/utils"
import {
  taskInitializer,
  default as tasksManager,
} from "decentraland-gatsby/dist/entities/Task"
import express from "express"

import categoryRoute from "./entities/Category/routes"
import placeRoute from "./entities/Place/routes"
import userFavoriteRoute from "./entities/UserFavorite/routes"
import userLikesRoute from "./entities/UserLikes/routes"

// const jobs = manager()
// jobs.cron('@eachMinute', () => console.log('Runnign Job...'))

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
app.use(
  filesystem("public", "404.html", {
    defaultHeaders: {
      "Content-Security-Policy": `base-uri 'self'; child-src https:; connect-src https: wss:; default-src 'none'; font-src https: data:; form-action 'self'; frame-ancestors 'none'; frame-src https:; img-src https: data:; manifest-src 'self'; media-src 'self'; object-src 'none'; prefetch-src https: data:; style-src 'unsafe-inline' https: data:; worker-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://decentraland.org https://*.decentraland.org https://cdn.segment.com https://cdn.rollbar.com https://ajax.cloudflare.com https://googleads.g.doubleclick.net https://ssl.google-analytics.com https://tagmanager.google.com https://www.google-analytics.com https://www.google-analytics.com https://www.google.com https://www.googleadservices.com https://www.googletagmanager.com`,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "strict-transport-security":
        "max-age=15552000; includeSubDomains; preload",
      "referrer-policy": "strict-origin-when-cross-origin",
      "x-xss-protection": "1; mode=block",
    },
  })
)

initializeServices([
  databaseInitializer(),
  taskInitializer(tasks),
  serverInitializer(app, process.env.PORT, process.env.HOST),
])
