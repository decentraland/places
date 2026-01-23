import CommsGatekeeper from "../../api/CommsGatekeeper"
import { SceneStats, SceneStatsMap } from "../../api/DataTeam"
import { AggregatePlaceAttributes, HotScene } from "../Place/types"
import { WorldLiveDataProps } from "../World/types"

export type ConnectedUsersMap = Map<string, string[]>

/**
 * Fetches connected users for a list of destinations from comms-gatekeeper.
 * Returns a map where keys are pointer/parcel (for places) or world_name (for worlds),
 * and values are arrays of wallet addresses.
 *
 * @param destinations - Array of destination attributes (places and/or worlds)
 * @returns Promise resolving to a map of destination identifiers to wallet addresses
 */
export async function fetchConnectedUsersForDestinations(
  destinations: AggregatePlaceAttributes[]
): Promise<ConnectedUsersMap> {
  const connectedUsersMap: ConnectedUsersMap = new Map()
  const commsGatekeeper = CommsGatekeeper.get()

  // Separate worlds and places
  const worlds = destinations.filter((d) => d.world && d.world_name)
  const places = destinations.filter((d) => !d.world)

  // Fetch in parallel for better performance
  const fetchPromises: Promise<void>[] = []

  // Fetch world participants
  for (const world of worlds) {
    fetchPromises.push(
      commsGatekeeper
        .getWorldParticipants(world.world_name!)
        .then((addresses) => {
          connectedUsersMap.set(world.world_name!, addresses)
        })
        .catch((error) => {
          console.error(
            `Error fetching participants for world ${world.world_name}:`,
            error
          )
          connectedUsersMap.set(world.world_name!, [])
        })
    )
  }

  // Fetch scene participants (using base_position as the pointer identifier)
  for (const place of places) {
    fetchPromises.push(
      commsGatekeeper
        .getSceneParticipants(place.base_position)
        .then((addresses) => {
          connectedUsersMap.set(place.base_position, addresses)
        })
        .catch((error) => {
          console.error(
            `Error fetching participants for place ${place.base_position}:`,
            error
          )
          connectedUsersMap.set(place.base_position, [])
        })
    )
  }

  await Promise.all(fetchPromises)

  return connectedUsersMap
}

export function destinationsWithAggregates(
  destinations: AggregatePlaceAttributes[],
  hotScenes: HotScene[],
  placesSceneStats: SceneStatsMap,
  worldsLiveData: WorldLiveDataProps,
  options?: {
    withRealmsDetail: boolean
    withConnectedUsers: boolean
    connectedUsersMap?: ConnectedUsersMap
  }
) {
  return destinations.map((destination) => {
    const placesStats: SceneStats | undefined =
      placesSceneStats[destination.base_position] ||
      (destination.positions || []).reduce<SceneStats | undefined>(
        (acc, position) => acc || placesSceneStats[position],
        undefined
      )
    let user_count = 0
    let user_visits = 0

    const hotScenePlaces = hotScenes.find((scene) =>
      scene.parcels
        .map((parcel) => parcel.join(","))
        .includes(destination.base_position)
    )

    if (destination.world) {
      user_count =
        (worldsLiveData?.perWorld &&
          worldsLiveData.perWorld.find(
            (world) => world.worldName === destination.world_name
          )?.users) ||
        0
      // TODO: Get Worlds user visits when available
      // user_visits = worldStats?.last_30d?.users || 0
    } else {
      user_count = hotScenePlaces?.usersTotalCount || 0
      user_visits = placesStats?.last_30d?.users || 0
    }

    if (options?.withRealmsDetail && !destination.world) {
      destination.realms_detail = hotScenePlaces?.realms || []
    }

    // Get connected addresses if requested
    let connected_addresses: string[] | undefined
    if (options?.withConnectedUsers && options.connectedUsersMap) {
      // Use world_name for worlds, base_position for places
      const key = destination.world
        ? destination.world_name || ""
        : destination.base_position
      connected_addresses = options.connectedUsersMap.get(key) || []
    }

    // Use connected_addresses count if available and greater than hot scenes count
    // This ensures user_count reflects real-time data when available
    const finalUserCount =
      connected_addresses && connected_addresses.length > user_count
        ? connected_addresses.length
        : user_count

    const result: AggregatePlaceAttributes & {
      connected_addresses?: string[]
    } = {
      ...destination,
      user_visits: user_visits,
      user_count: finalUserCount,
    }

    if (connected_addresses) {
      result.connected_addresses = connected_addresses
    }

    return result
  })
}
