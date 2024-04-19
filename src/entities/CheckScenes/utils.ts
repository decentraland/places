import { EntityType } from "@dcl/schemas/dist/platform/entity"
import AWS from "aws-sdk"
import logger from "decentraland-gatsby/dist/entities/Development/logger"
import Catalyst from "decentraland-gatsby/dist/utils/api/Catalyst"
import {
  ContentDeploymentScene,
  ContentDeploymentSortingField,
  ContentDeploymentSortingOrder,
  ContentEntityScene,
} from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import ContentServer from "decentraland-gatsby/dist/utils/api/ContentServer"
import env from "decentraland-gatsby/dist/utils/env"

import allCoordinates from "../../__data__/AllCoordinates.json"
import roadCoordinates from "../../__data__/RoadCoordinates.json"
import areSamePositions from "../../utils/array/areSamePositions"
import { PlaceAttributes } from "../Place/types"
import PlacePositionModel from "../PlacePosition/model"
import { DeploymentTrackAttributes, WorldAbout } from "./types"

const ACCESS_KEY = env("AWS_ACCESS_KEY")
const ACCESS_SECRET = env("AWS_ACCESS_SECRET")
const BUCKET_NAME = env("PUBLIC_BUCKET", "")

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

async function calculateGenesisCityManifestPositions(): Promise<ManifestResponse> {
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

export async function updateGenesisCityManifest() {
  const s3 = new AWS.S3({
    accessKeyId: ACCESS_KEY,
    secretAccessKey: ACCESS_SECRET,
    s3ForcePathStyle: true,
  })
  logger.log("Updating Genesis City manifest")

  const genesisCityManifestPositions =
    await calculateGenesisCityManifestPositions()

  const uploadParams = {
    Bucket: BUCKET_NAME,
    Key: `WorldManifest.json`,
    Body: JSON.stringify(genesisCityManifestPositions),
    ContentType: "application/json",
    CacheControl: "no-store, no-cache, must-revalidate, proxy-revalidate",
  }

  try {
    await s3.upload(uploadParams).promise()

    logger.log("Genesis City manifest updated correctly")
  } catch (error: any) {
    logger.error("Failed to update Genesis City manifest", {
      error: error?.message,
    })
  }
}

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
