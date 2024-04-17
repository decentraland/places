import { EntityType } from "@dcl/schemas/dist/platform/entity"
import Catalyst from "decentraland-gatsby/dist/utils/api/Catalyst"
import {
  ContentDeploymentScene,
  ContentDeploymentSortingField,
  ContentDeploymentSortingOrder,
  ContentEntityScene,
} from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import ContentServer from "decentraland-gatsby/dist/utils/api/ContentServer"

import allCoordinates from "../../__data__/AllCoordinates.json"
import roadCoordinates from "../../__data__/RoadCoordinates.json"
import areSamePositions from "../../utils/array/areSamePositions"
import { PlaceAttributes } from "../Place/types"
import PlacePositionModel from "../PlacePosition/model"
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

type Pointer = string

interface ManifestResponse {
  roads: Pointer[]
  occupied: Pointer[]
  empty: Pointer[]
}

export async function getWorldAbout(
  url: string,
  worldName: string
): Promise<WorldAbout> {
  const worldContentServer = await ContentServer.getInstanceFrom(url)
  return worldContentServer.fetch(`/world/${worldName}/about`)
}

export async function calculateGenesisCityManifestPositions(): Promise<ManifestResponse> {
  const occupiedPositions = (await PlacePositionModel.find()).map(
    (place) => place.position
  )

  const roadSet = new Set(roadCoordinates)
  const occupiedSet = new Set(occupiedPositions)
  const restOfCoordinatesSet = new Set(allCoordinates)

  const response: ManifestResponse = {
    roads: Array.from(roadSet),
    occupied: Array.from(occupiedSet),
    empty: [],
  }

  roadSet.forEach((coordinate) => restOfCoordinatesSet.delete(coordinate))
  occupiedSet.forEach((coordinate) => restOfCoordinatesSet.delete(coordinate))

  response.empty = Array.from(restOfCoordinatesSet)

  return response
}
