import env from "decentraland-gatsby/dist/utils/env"
import fetch from "node-fetch"

type ShouldIndexResponseProps = {
  data: { dclName: string; shouldBeIndexed: boolean }[]
}

export async function verifyWorldsIndexing(names: string[]) {
  try {
    const shouldIndexFetch = await fetch(
      env(
        "WORLDS_INDEX_API",
        "https://dcl-name-stats.decentraland.org/should-index"
      ),
      {
        body: JSON.stringify({ dclNames: names }),
        method: "POST",
      }
    )
    const shouldIndex: ShouldIndexResponseProps = await shouldIndexFetch.json()
    return shouldIndex.data
  } catch (error) {
    return []
  }
}
