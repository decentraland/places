import { ContentDepoymentScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { getThumbnailFromDeployment } from "../Place/utils"
import roads from "./data/roads.json"

export function isMetadataEmpty(deployment: ContentDepoymentScene) {
  const thumbnail = getThumbnailFromDeployment(deployment)
  return (
    ((!deployment.metadata?.display?.title ||
      deployment.metadata?.display?.title === "interactive-text") &&
      !deployment.metadata?.display?.description) ||
    !!thumbnail.startsWith("https://api.decentraland.org")
  )
}

export function isRoad(deployment: ContentDepoymentScene) {
  return deployment.pointers.every((position) => {
    const roadsMap = roads as Record<string, Record<string, true>>
    const [x, y] = position.split(",")

    return (roadsMap[x] && roadsMap[x][y]) || false
  })
}
