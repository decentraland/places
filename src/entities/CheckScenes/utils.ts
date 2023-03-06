import { EntityType } from "@dcl/schemas/dist/platform/entity"
import Catalyst from "decentraland-gatsby/dist/utils/api/Catalyst"
import {
  ContentDeploymentScene,
  ContentDeploymentSortingField,
  ContentDeploymentSortingOrder,
  ContentDeploymentWorld,
  EntityScene,
} from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import areSamePositions from "../../utils/array/areSamePositions"
import { PlaceAttributes } from "../Place/types"
import { getThumbnailFromDeployment } from "../Place/utils"
import roads from "./data/roads.json"
import { DeploymentTrackAttributes } from "./types"

/** @deprecated */
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

  return contentDeploymentsResponse.deployments as ContentDeploymentScene[]
}

export function isMetadataEmpty(deployment: EntityScene) {
  const thumbnail = getThumbnailFromDeployment(deployment)
  return (
    ((!deployment.metadata?.display?.title ||
      deployment.metadata?.display?.title === "interactive-text") &&
      !deployment.metadata?.display?.description) ||
    !!thumbnail.startsWith("https://api.decentraland.org")
  )
}

export function isRoad(deployment: Pick<EntityScene, "pointers">) {
  return deployment.pointers.every((position) => {
    const roadsMap = roads as Record<string, Record<string, true>>
    const [x, y] = position.split(",")

    return (roadsMap[x] && roadsMap[x][y]) || false
  })
}

export function isNewPlace(
  contentDeployment: ContentDeploymentScene | ContentDeploymentWorld,
  places: PlaceAttributes[]
) {
  if (places.length === 0) {
    return true
  }
  const sameBasePosition = places.find(
    (place) => place.base_position === contentDeployment.metadata.scene.base
  )

  if (sameBasePosition) {
    return false
  }

  const samePosition = places.find((place) =>
    areSamePositions(contentDeployment.pointers, place.positions)
  )

  if (samePosition) {
    return false
  }

  return true
}

export function isSamePlace(
  contentDeployment: ContentDeploymentScene | ContentDeploymentWorld,
  place: PlaceAttributes
) {
  return (
    place.base_position === contentDeployment.metadata.scene.base ||
    areSamePositions(contentDeployment.pointers, place.positions)
  )
}
