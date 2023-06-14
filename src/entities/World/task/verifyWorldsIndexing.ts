import { Logger } from "decentraland-gatsby/dist/entities/Development/logger"
import fetch from "node-fetch"

type ShouldIndexResponseProps = {
  data: { dclName: string; shouldBeIndexed: boolean }[]
}

export async function verifyWorldsIndexing(names: string[]) {
  const shouldIndexFetch = await fetch(
    "https://dcl-name-stats.decentraland.org/should-index",
    {
      body: JSON.stringify({ dclNames: names }),
      method: "POST",
    }
  )
  const shouldIndex: ShouldIndexResponseProps = await shouldIndexFetch.json()
  const shouldIndexNames = shouldIndex.data
    .map((world) => world.shouldBeIndexed === true && world.dclName)
    .filter((world) => !!world) as string[]

  const shouldNotIndexNames = shouldIndex.data
    .map((world) => world.shouldBeIndexed !== true && world.dclName)
    .filter((world) => !!world) as string[]

  const logger = new Logger()
  logger.log(
    `Should index ${shouldIndexNames.length} - Should not index ${shouldNotIndexNames.length}`
  )

  return {
    indexNames: shouldIndexNames,
    hasIndexNames: shouldIndexNames.length > 0,
    nonIndexNames: shouldNotIndexNames,
    hasNonIndexNames: shouldNotIndexNames.length > 0,
  }
}
