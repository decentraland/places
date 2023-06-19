import fetch from "node-fetch"

type ShouldIndexResponseProps = {
  data: { dclName: string; shouldBeIndexed: boolean }[]
}

export async function verifyWorldsIndexing(names: string[]) {
  try {
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

    return {
      indexNames: shouldIndexNames,
      hasIndexNames: shouldIndexNames.length > 0,
      nonIndexNames: shouldNotIndexNames,
      hasNonIndexNames: shouldNotIndexNames.length > 0,
    }
  } catch (error) {
    return {
      indexNames: [],
      hasIndexNames: false,
      nonIndexNames: [],
      hasNonIndexNames: false,
    }
  }
}
