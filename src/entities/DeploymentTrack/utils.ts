import { EntityType } from "@dcl/schemas/dist/platform/entity"
import Catalyst from "decentraland-gatsby/dist/utils/api/Catalyst"
import {
  ContentDeploymentSortingField,
  ContentDeploymentSortingOrder,
  ContentDepoymentScene,
} from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import roads from "./data/roads.json"
import { DeploymentTrackAttributes } from "./types"

export async function fetchDeployments(catalyst: DeploymentTrackAttributes) {
  const contentDeploymentsResponse = await Catalyst.from(
    catalyst.base_url
  ).getContentDeployments({
    from: catalyst.from,
    limit: catalyst.limit,
    entityTypes: [EntityType.SCENE],
    onlyCurrentlyPointed: true,
    sortingField: ContentDeploymentSortingField.LocalTimestamp,
    sortingOrder: ContentDeploymentSortingOrder.ASCENDING,
  })

  return contentDeploymentsResponse.deployments as ContentDepoymentScene[]
}

export function isMetadataEmpty(deployment: ContentDepoymentScene) {
  let thumbnail = deployment?.metadata?.display?.navmapThumbnail || null
  if (thumbnail && !thumbnail.startsWith("https://")) {
    const content = deployment.content.find(
      (content) => content.key === thumbnail
    )
    if (
      !content ||
      content.hash ===
        "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku" ||
      content.hash === "QmdfTbBqBPQ7VNxZEYEj14VmRuZBkqFbiwReogJgS1zR1n"
    ) {
      thumbnail = null
    }
  }
  return (
    ((!deployment.metadata?.display?.title ||
      deployment.metadata?.display?.title === "interactive-text") &&
      !deployment.metadata?.display?.description) ||
    !thumbnail
  )
}

export function isRoad(deployment: ContentDepoymentScene) {
  return deployment.pointers.every((position) => {
    const roadsMap = roads as Record<string, Record<string, true>>
    const [x, y] = position.split(",")

    return (roadsMap[x] && roadsMap[x][y]) || false
  })
}
