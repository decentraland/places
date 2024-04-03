import { EntityType } from "@dcl/schemas/dist/platform/entity"
import Catalyst from "decentraland-gatsby/dist/utils/api/Catalyst"
import {
  ContentDeploymentScene,
  ContentDeploymentSortingField,
  ContentDeploymentSortingOrder,
  ContentEntityScene,
} from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import ContentServer from "decentraland-gatsby/dist/utils/api/ContentServer"

import areSamePositions from "../../utils/array/areSamePositions"
import { PlaceAttributes } from "../Place/types"
import PlacePositionModel from "../PlacePosition/model"
import roadCoordinates from "./RoadCoordinates.json"
import { DeploymentTrackAttributes, WorldAbout } from "./types"

/** @deprecated */
export async function fetchDeployments(catalyst: DeploymentTrackAttributes) {
  const contentDeploymentsResponse = await Catalyst.getInstanceFrom(
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

export function findSamePlace(
  contentEntityScene: ContentEntityScene,
  places: PlaceAttributes[]
): PlaceAttributes | null {
  if (places.length === 0) {
    return null
  }

  const sameBasePosition = places.find(
    (place) => place.base_position === contentEntityScene.metadata.scene!.base
  )

  if (sameBasePosition) {
    return sameBasePosition
  }

  const samePosition = places.find((place) =>
    areSamePositions(contentEntityScene.pointers, place.positions)
  )

  if (samePosition) {
    return samePosition
  }

  return null
}

export function findNewDeployedPlace(
  contentEntityScene: ContentEntityScene,
  places: PlaceAttributes[]
): PlaceAttributes | null {
  if (places.length === 0) {
    return null
  }

  const newDeployedPlace = places.find(
    (place) =>
      new Date(place.deployed_at) > new Date(contentEntityScene.timestamp)
  )

  return newDeployedPlace || null
}

export function isSameWorld(
  contentEntityScene: ContentEntityScene,
  place: PlaceAttributes
) {
  return (
    place.world &&
    place.world_name === contentEntityScene.metadata.worldConfiguration?.name
  )
}

export async function getWorldAbout(
  url: string,
  worldName: string
): Promise<WorldAbout> {
  const worldContentServer = await ContentServer.getInstanceFrom(url)
  return worldContentServer.fetch(`/world/${worldName}/about`)
}

export async function calculateWorldManifestPositions() {
  const occupiedPositions = await PlacePositionModel.find({})
  const emptyPositions = []

  for (let x = -150; x <= 150; x++) {
    for (let y = -150; y <= 150; y++) {
      const position = [x.toString(), y.toString()]
      if (
        !occupiedPositions.some((place) =>
          areSamePositions(place.position, position)
        ) &&
        !roadCoordinates.some((roadPosition) =>
          areSamePositions(roadPosition.split(","), position)
        )
      ) {
        emptyPositions.push(position)
      }
    }
  }

  return { occupiedPositions, emptyPositions, roadPositions: roadCoordinates }
}
