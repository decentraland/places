import { EntityType } from "@dcl/schemas/dist/platform/entity"
import Catalyst from "decentraland-gatsby/dist/utils/api/Catalyst"
import {
  ContentDeploymentScene,
  ContentDeploymentSortingField,
  ContentDeploymentSortingOrder,
  ContentEntityScene,
} from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import areSamePositions from "../../utils/array/areSamePositions"
import areShrinkPositions from "../../utils/array/areShrinkPositions"
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

/**@deprecated */
export function isMetadataEmpty(deployment: ContentEntityScene) {
  const thumbnail = getThumbnailFromDeployment(deployment)
  return (
    ((!deployment.metadata?.display?.title ||
      deployment.metadata?.display?.title === "interactive-text") &&
      !deployment.metadata?.display?.description) ||
    !!thumbnail.startsWith("https://api.decentraland.org")
  )
}

export function isRoad(deployment: Pick<ContentEntityScene, "pointers">) {
  return deployment.pointers.every((position) => {
    const roadsMap = roads as Record<string, Record<string, true>>
    const [x, y] = position.split(",")

    return (roadsMap[x] && roadsMap[x][y]) || false
  })
}

export function isNewPlace(
  contentDeployment: ContentEntityScene,
  places: PlaceAttributes[]
) {
  if (places.length === 0) {
    return true
  }
  const sameBasePosition = places.find(
    (place) => place.base_position === contentDeployment.metadata.scene!.base
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

  const shrinkPosition = places.find((place) =>
    areShrinkPositions(contentDeployment.pointers, place.positions)
  )

  if (shrinkPosition) {
    return false
  }

  return true
}

export function isSamePlace(
  contentDeployment: ContentEntityScene,
  place: PlaceAttributes
) {
  return (
    place.base_position === contentDeployment.metadata.scene!.base ||
    areSamePositions(contentDeployment.pointers, place.positions) ||
    areShrinkPositions(contentDeployment.pointers, place.positions)
  )
}
