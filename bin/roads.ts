import { writeFileSync } from "fs"
import { resolve } from "path"

import fetch from "node-fetch"

Promise.resolve().then(async () => {
  const req = await fetch(
    "https://raw.githubusercontent.com/decentraland/atlas-server/master/src/modules/map/data/specialTiles.json"
  )
  const tiles = await req.json()
  const roads = Object.keys(tiles)
    .filter((position) => tiles[position].type === "road")
    .sort()

  const map: Record<string, Record<string, true>> = {}
  for (const road of roads) {
    const [x, y] = road.split(",")
    if (!map[x]) {
      map[x] = {}
    }

    map[x][y] = true
  }

  const target = resolve(
    __dirname,
    "../src/entities/DeploymentTrack/data/roads.json"
  )
  console.log(`creating ${target} with ${roads.length} roads`)
  writeFileSync(target, JSON.stringify(map, null, 2))
})
