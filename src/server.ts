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
import mapRoute from "./entities/Map/routes"
import placeRoute from "./entities/Place/routes"
import { checkPoisForCategoryUpdate } from "./entities/PlaceCategories/tasks/poi"
import { hotScenesUpdate } from "./entities/RealmProvider/tasks/hotScenesUpdate"
import reportRoute from "./entities/Report/routes"
import socialRoutes from "./entities/Social/routes"
import userFavoriteRoute from "./entities/UserFavorite/routes"
import userLikesRoute from "./entities/UserLikes/routes"
import worldRoute from "./entities/World/routes"
import { worldsLiveDataUpdate } from "./entities/World/tasks/worldsLiveData"
import destinationRoute from "./entities/Destination/routes"

const tasks = tasksManager()
tasks.use(
  createSceneConsumerTask(
    new SQS({
      apiVersion: "latest",
      region: env("AWS_REGION"),
      endpoint: env("AWS_ENDPOINT"),
    }),
    {
      AttributeNames: ["SentTimestamp"],
      MaxNumberOfMessages: 10,
      MessageAttributeNames: ["All"],
      QueueUrl: env("QUEUE_URL")!,
      WaitTimeSeconds: 15,
      VisibilityTimeout: 600,
    }
  )
)

tasks.use(checkPoisForCategoryUpdate)
tasks.use(hotScenesUpdate)
tasks.use(worldsLiveDataUpdate)

const app = express()
app.set("x-powered-by", false)
app.use(withLogs())
app.use("/api", [
  withCors({
    corsOrigin: [
      /^http:\/\/localhost:[0-9]{1,10}$/,
      /^https:\/\/(.{1,50}\.)?decentraland\.(zone|today|org)$/,
      /https:\/\/dcl-preview\.vercel\.app/,
      /https:\/\/([a-zA-Z0-9\-_])+-decentraland1\.vercel\.app/,
    ],
    allowedHeaders: "*",
  }),
  withBody(),
  categoryRoute,
  userFavoriteRoute,
  userLikesRoute,
  placeRoute,
  worldRoute,
  reportRoute,
  mapRoute,
  destinationRoute,

  status(),
  handle(async () => {
    throw new RequestError("NotFound", RequestError.NotFound)
  }),
])

app.use(metrics([gatsbyRegister, register]))
app.use("/places", socialRoutes)
app.use("/places", [
  withCors({
    corsOrigin: [
      /^http:\/\/localhost:[0-9]{1,10}$/,
      /^https:\/\/(.{1,50}\.)?decentraland\.(zone|today|org)$/,
      /https:\/\/([a-zA-Z0-9\-_])+-decentraland1\.vercel\.app/,
    ],
    allowedHeaders: "*",
  }),
  gatsby(resolve(__filename, "../../public"), {
    crossOriginOpenerPolicy: "same-origin",
    contentSecurityPolicy: {
      fontSrc: [
        "https://decentraland.org",
        "https://decentraland.today",
        "https://decentraland.zone",
        "https://*.decentraland.org",
        "https://*.decentraland.today",
        "https://*.decentraland.zone",
        // Used to test the proxied service
        // "http://192.168.1.8:*",
      ],
      styleSrc: [
        "https://decentraland.org",
        "https://decentraland.today",
        "https://decentraland.zone",
        "https://*.decentraland.org",
        "https://*.decentraland.today",
        "https://*.decentraland.zone",
        // Used to test the proxied service
        // "http://192.168.1.8:*",
      ],
      imgSrc: [
        "https://decentraland.org",
        "https://decentraland.today",
        "https://decentraland.zone",
        "https://*.decentraland.org",
        "https://*.decentraland.today",
        "https://*.decentraland.zone",
        // Used to test the proxied service
        // "http://192.168.1.8:*",
      ],
      manifestSrc: [
        "https://decentraland.org",
        "https://decentraland.today",
        "https://decentraland.zone",
        "https://*.decentraland.org",
        "https://*.decentraland.today",
        "https://*.decentraland.zone",
        // Used to test the proxied service
        // "http://192.168.1.8:*",
      ],
      scriptSrc: [
        "https://decentraland.org",
        "https://decentraland.today",
        "https://decentraland.zone",
        "https://*.decentraland.org",
        "https://*.decentraland.today",
        "https://*.decentraland.zone",
        // Used to test the proxied service
        // "http://192.168.1.8:*",
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
        "https://browser.sentry-cdn.com",
      ].join(" "),
      connectSrc: [
        "https:",
        "*.sentry.io",
        "https://decentraland.org",
        "https://decentraland.today",
        "https://decentraland.zone",
        "https://*.decentraland.org",
        "https://*.decentraland.today",
        "https://*.decentraland.zone",
        // Used to test the proxied service
        // "http://192.168.1.8:*",
      ].join(" "),
      workerSrc: ["'self'", "blob:"].join(" "),
      frameSrc: ["https:", "dcl:", "decentraland:"].join(" "),
    },
  }),
])

initializeServices([
  databaseInitializer(),
  taskInitializer(tasks),
  serverInitializer(app, process.env.PORT, process.env.HOST),
])
