import { resolve } from "path"

import SQS from "aws-sdk/clients/sqs"
import { databaseInitializer } from "decentraland-gatsby/dist/entities/Database/utils"
import { gatsbyRegister } from "decentraland-gatsby/dist/entities/Prometheus/metrics"
import metrics from "decentraland-gatsby/dist/entities/Prometheus/routes/utils"
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
import env from "decentraland-gatsby/dist/utils/env"
import express from "express"
import { register } from "prom-client"

import categoryRoute from "./entities/Category/routes"
import { createSceneConsumerTask } from "./entities/CheckScenes/task/checkScenes"
import placeRoute from "./entities/Place/routes"
import socialRoutes from "./entities/Social/routes"
import userFavoriteRoute from "./entities/UserFavorite/routes"
import userLikesRoute from "./entities/UserLikes/routes"
import worldRoute from "./entities/World/routes"
import { checkWorldsIndexingTask } from "./entities/World/task/checkWorldsIndexingTask"

const tasks = tasksManager()
tasks.use(
  createSceneConsumerTask(
    new SQS({ apiVersion: "latest", region: env("AWS_REGION") }),
    {
      AttributeNames: ["SentTimestamp"],
      MaxNumberOfMessages: 10,
      MessageAttributeNames: ["All"],
      QueueUrl: env("QUEUE_URL")!,
      WaitTimeSeconds: 15,
      VisibilityTimeout: 3 * 3600, // 3 hours
    }
  )
)
tasks.use(checkWorldsIndexingTask)

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
  worldRoute,

  status(),
  handle(async () => {
    throw new RequestError("NotFound", RequestError.NotFound)
  }),
])

app.use(metrics([gatsbyRegister, register]))
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
        "https://ajax.cloudflare.com",
        "https://googleads.g.doubleclick.net",
        "https://ssl.google-analytics.com",
        "https://tagmanager.google.com",
        "https://www.google-analytics.com",
        "https://www.google-analytics.com",
        "https://www.google.com",
        "https://www.googleadservices.com",
        "https://www.googletagmanager.com",
        "https://app.intercom.io",
        "https://widget.intercom.io",
        "https://js.intercomcdn.com",
        "https://verify.walletconnect.com",
        "https://js.sentry-cdn.com",
      ].join(" "),
    },
  })
)

initializeServices([
  databaseInitializer(),
  taskInitializer(tasks),
  serverInitializer(app, process.env.PORT, process.env.HOST),
])
