import AWS from "aws-sdk"
import logger from "decentraland-gatsby/dist/entities/Development/logger"
import { ContentEntityScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import env from "decentraland-gatsby/dist/utils/env"

import allCoordinates from "../../__data__/AllCoordinates.json"
import roadCoordinates from "../../__data__/RoadCoordinates.json"
import areSamePositions from "../../utils/array/areSamePositions"
import { PlaceAttributes } from "../Place/types"
import PlacePositionModel from "../PlacePosition/model"

const ACCESS_KEY = env("AWS_ACCESS_KEY")
const ACCESS_SECRET = env("AWS_ACCESS_SECRET")
const BUCKET_NAME = env("PUBLIC_BUCKET", "")

type Pointer = string

interface ManifestResponse {
  roads: Pointer[]
  occupied: Pointer[]
  empty: Pointer[]
}

const MARKETPLACE_SUBGRAPH_URL = env(
  "MARKETPLACE_SUBGRAPH_URL",
  "https://subgraph.decentraland.org/marketplace"
)
const ENS_SUBGRAPH_URL = env(
  "ENS_SUBGRAPH_URL",
  "https://subgraph.decentraland.org/ens"
)

const DCL_NAME_SUFFIX = ".dcl.eth"

/**
 * Fetches the on-chain owner of a world name by querying the appropriate
 * subgraph based on the name suffix:
 * - `.dcl.eth` names — Marketplace subgraph (NFT owner).
 * - External ENS names — ENS subgraph (wrapped owner).
 *
 * Returns `undefined` on any error so that a subgraph outage never
 * blocks scene deployment processing.
 *
 * @param worldName - The world name, e.g. `"myworld.dcl.eth"` or `"myworld.eth"`.
 * @returns The owner address, or `undefined` if resolution fails.
 */
export async function fetchNameOwner(
  worldName: string
): Promise<string | undefined> {
  try {
    if (worldName.endsWith(DCL_NAME_SUFFIX)) {
      return await fetchDclNameOwner(worldName)
    }

    return await fetchEnsNameOwner(worldName)
  } catch {
    return undefined
  }
}

/**
 * Resolves the owner of a `.dcl.eth` name by querying the Marketplace
 * subgraph. The subdomain (without the `.dcl.eth` suffix) is looked up
 * as an ENS-category NFT and the current NFT owner address is returned.
 *
 * @param worldName - Full DCL world name, e.g. `"myworld.dcl.eth"`.
 * @returns The owner address, or `undefined` if the name is not found or the query fails.
 */
async function fetchDclNameOwner(
  worldName: string
): Promise<string | undefined> {
  const subdomain = worldName.slice(0, -DCL_NAME_SUFFIX.length)

  const response = await fetch(MARKETPLACE_SUBGRAPH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: `query getOwner($domains: [String!]) {
        nfts(first: 1, where: { searchText_in: $domains, category: ens }) {
          owner { address }
        }
      }`,
      variables: { domains: [subdomain.toLowerCase()] },
    }),
  })

  if (!response.ok) {
    return undefined
  }

  const result = await response.json()
  return result?.data?.nfts?.[0]?.owner?.address as string | undefined
}

/**
 * Resolves the owner of an external ENS name (e.g. `"myworld.eth"`) by
 * querying the ENS subgraph. Returns the `wrappedOwner` address, which
 * represents the current controller of the name.
 *
 * @param worldName - Full ENS domain, e.g. `"myworld.eth"`.
 * @returns The wrapped owner address, or `undefined` if the name is not found or the query fails.
 */
async function fetchEnsNameOwner(
  worldName: string
): Promise<string | undefined> {
  const response = await fetch(ENS_SUBGRAPH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: `query getOwner($domains: [String]) {
        domains(where: { name_in: $domains }) {
          owner { id }
          wrappedOwner { id }
        }
      }`,
      variables: { domains: [worldName.toLowerCase()] },
    }),
  })

  if (!response.ok) {
    return undefined
  }

  const result = await response.json()
  const domain = result?.data?.domains?.[0]
  return (domain?.wrappedOwner?.id || domain?.owner?.id) as string | undefined
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
