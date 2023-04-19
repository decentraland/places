import { createReadStream, readdirSync, statSync, unlinkSync } from "fs"
import { resolve } from "path"

import SQS from "aws-sdk/clients/sqs"
import logger from "decentraland-gatsby/dist/entities/Development/logger"
import { requiredEnv } from "decentraland-gatsby/dist/utils/env"
import lineReader from "line-reader"

import {
  DeploymentToSqs,
  SQSConsumer,
} from "../src/entities/CheckScenes/task/consumer"

Promise.resolve().then(async () => {
  const consumer = new SQSConsumer(
    new SQS({ apiVersion: "latest", region: requiredEnv("AWS_REGION") }),
    {
      QueueUrl: requiredEnv("QUEUE_URL"),
    }
  )

  const seedFolder = resolve(__dirname, "./")
  const filesInFolder = readdirSync(seedFolder)

  const txtFiles = filesInFolder.filter((file) => file.endsWith(".txt"))
  let totalCounter = 0
  let totalAdded = 0
  for (const txtFile of txtFiles) {
    let lineCounter = 0
    let linesPerHash = 0
    let batch: DeploymentToSqs[] = []
    const newTarget = resolve(__dirname, `./${txtFile}`)

    const stats = statSync(newTarget)
    const fileSizeInBytes = stats.size
    const fileSizeInMegabytes = fileSizeInBytes / (1024 * 1024)
    logger.log(
      `Starting file ${newTarget} with size ${fileSizeInMegabytes.toFixed(
        2
      )} MB`
    )

    const readStream = createReadStream(newTarget, "utf-8")

    lineReader.eachLine(readStream, async function (line, last) {
      totalCounter++
      linesPerHash++
      if (line.includes('"entityType":"scene"')) {
        lineCounter++
        totalAdded++
        const parsed = JSON.parse(line)
        const data = {
          entity: {
            entityId: parsed.entityId,
            authChain: parsed.authChain,
          },
          contentServerUrls: ["https://peer.decentraland.org/content"],
        }
        batch.push(data)
        if (batch.length === 10 || last) {
          await consumer.publishBatch(batch)
          batch = []
        }
      }

      if (last) {
        totalCounter--
        lineCounter--
        linesPerHash--
        logger.log(
          `Snapshot ${txtFile}: added ${lineCounter} scenes to SQS from a total of ${totalCounter} lines. Lines per hash: ${linesPerHash}`
        )
        linesPerHash = 0
        lineCounter = 0
        const usedMemory = process.memoryUsage().heapUsed / 1024 / 1024
        logger.log(
          `The script uses approximately ${
            Math.round(usedMemory * 100) / 100
          } MB`
        )
        logger.log(`Total added: ${totalAdded} scenes until now`)
        unlinkSync(newTarget)
      }
    })
  }
  return
})
