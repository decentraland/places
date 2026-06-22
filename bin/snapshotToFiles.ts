import { createWriteStream } from "node:fs"
import { Readable, pipeline } from "node:stream"
import { promisify } from "node:util"
import { resolve } from "path"

import logger from "decentraland-gatsby/dist/entities/Development/logger"

const streamPipeline = promisify(pipeline)

Promise.resolve().then(async () => {
  const snapshots = await fetch(
    "https://peer.decentraland.org/content/snapshots"
  )
  const snapshotsJson = await snapshots.json()
  for (const snapshot of snapshotsJson) {
    logger.log(`fetching snapshot ${snapshot.hash}...`)
    const content = await fetch(
      `https://peer.decentraland.org/content/contents/${snapshot.hash}`
    )

    if (!content.body) {
      logger.log(`No content body for snapshot ${snapshot.hash}, skipping`)
      continue
    }

    const newTarget = resolve(__dirname, `./${snapshot.hash}.txt`)
    await streamPipeline(
      Readable.fromWeb(
        content.body as unknown as Parameters<typeof Readable.fromWeb>[0]
      ),
      createWriteStream(newTarget)
    )
    logger.log(`Done writing file: ${newTarget}`)
  }
  return
})
