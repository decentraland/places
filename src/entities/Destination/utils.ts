import { AggregateDestinationAttributes } from "./types"
import CommsGatekeeper from "../../api/CommsGatekeeper"
import { SceneStats, SceneStatsMap } from "../../api/DataTeam"
import Events from "../../api/Events"
import { HotScene, PlaceListOrderBy } from "../Place/types"
import { WorldLiveDataProps } from "../World/types"

/**
 * Destination identifier to the wallet addresses connected there, or null when comms-gatekeeper
 * could not be reached for it. Null rather than an empty array so an outage is not served as an
 * empty room: a client deciding whether to show presence needs "we don't know" to look different
 * from "nobody is here".
 */
export type ConnectedUsersMap = Map<string, string[] | null>
/**
 * Destination identifier to the name of the live event running there, or null when there is none.
 * Null rather than absent so a lookup miss and "no event" read the same way.
 */
export type LiveEventsMap = Map<string, string | null>

export type RealtimeUserCounts = {
  placeUserCounts: { base_position: string; count: number }[]
  worldUserCounts: { world_name: string; count: number }[]
}

/**
 * Build the realtime connected-user counts injected into the destinations query for MOST_ACTIVE
 * ordering: places keyed by `base_position` (from hot scenes) and worlds by `world_name` (from
 * world live data). Returns empty arrays unless ordering by most_active. See issue #7344.
 */
export function buildRealtimeUserCounts(
  orderBy: string,
  hotScenes: HotScene[],
  worldsLiveData: WorldLiveDataProps
): RealtimeUserCounts {
  if (orderBy !== PlaceListOrderBy.MOST_ACTIVE) {
    return { placeUserCounts: [], worldUserCounts: [] }
  }

  return {
    placeUserCounts: hotScenes.map((scene) => ({
      base_position: scene.baseCoords.join(","),
      count: scene.usersTotalCount,
    })),
    worldUserCounts: (worldsLiveData.perWorld ?? []).map((world) => ({
      world_name: world.worldName,
      count: world.users,
    })),
  }
}

/**
 * Fetches connected users for a list of destinations from comms-gatekeeper.
 * Returns a map where keys are pointer/parcel (for places) or world_name (for worlds),
 * and values are arrays of wallet addresses, or null for the destinations comms-gatekeeper could
 * not answer for.
 *
 * @param destinations - Array of destination attributes (places and/or worlds)
 * @returns Promise resolving to a map of destination identifiers to wallet addresses or null
 */
export async function fetchConnectedUsersForDestinations(
  destinations: AggregateDestinationAttributes[]
): Promise<ConnectedUsersMap> {
  const connectedUsersMap: ConnectedUsersMap = new Map()
  const commsGatekeeper = CommsGatekeeper.get()

  // Separate worlds and places
  const worlds = destinations.filter((d) => d.world && d.world_name)
  const places = destinations.filter((d) => !d.world)

  // Fetch in parallel for better performance
  const fetchPromises: Promise<void>[] = []

  // These catches look redundant, because the client already turns an unreachable comms-gatekeeper
  // into null rather than rejecting. They are not there for that case: they bound the blast radius.
  // This fans out one promise per destination into a Promise.all, so a single unexpected rejection
  // would fail the whole page rather than leaving one destination's presence unknown, and presence
  // is an enrichment that the listing should survive without.
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
          connectedUsersMap.set(world.world_name!, null)
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
          connectedUsersMap.set(place.base_position, null)
        })
    )
  }

  await Promise.all(fetchPromises)

  return connectedUsersMap
}

/**
 * Fetches the live event of each destination from the events API.
 * Keys are destination identifiers (place UUID for land places, world name for worlds).
 *
 * @param destinations - Array of destination attributes (places and/or worlds)
 * @returns Promise resolving to a map from each identifier to the name of the live event running
 *   there, or null when it has none
 */
export async function fetchLiveEventsForDestinations(
  destinations: AggregateDestinationAttributes[]
): Promise<LiveEventsMap> {
  const eventsApi = Events.get()

  // For worlds use world_name; for land places use the place UUID
  const destinationIds = destinations
    .map((d) => (d.world && d.world_name ? d.world_name : d.id))
    .filter(Boolean) as string[]

  return eventsApi.checkLiveEventsForDestinations(destinationIds)
}

export function destinationsWithAggregates(
  destinations: AggregateDestinationAttributes[],
  hotScenes: HotScene[],
  placesSceneStats: SceneStatsMap,
  worldsLiveData: WorldLiveDataProps,
  options?: {
    withRealmsDetail: boolean
    withConnectedUsers: boolean
    connectedUsersMap?: ConnectedUsersMap
    withLiveEvents: boolean
    liveEventsMap?: LiveEventsMap
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
            (world) =>
              world.worldName?.toLowerCase() != null &&
              world.worldName.toLowerCase() ===
                destination.world_name?.toLowerCase()
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

    // undefined means the caller did not ask for presence; null means it was asked for and
    // comms-gatekeeper could not answer.
    let connected_addresses: string[] | null | undefined
    if (options?.withConnectedUsers && options.connectedUsersMap) {
      // Use world_name for worlds, base_position for places
      const key = destination.world
        ? destination.world_name || ""
        : destination.base_position
      connected_addresses = options.connectedUsersMap.get(key) ?? null
    }

    // Use connected_addresses count if available and greater than hot scenes count
    // This ensures user_count reflects real-time data when available
    const finalUserCount =
      connected_addresses && connected_addresses.length > user_count
        ? connected_addresses.length
        : user_count

    // Get live event status if requested
    let live: boolean | undefined
    let live_event_name: string | null = null
    if (options?.withLiveEvents && options.liveEventsMap) {
      // Use world_name for worlds, UUID for land places
      const liveKey =
        destination.world && destination.world_name
          ? destination.world_name
          : destination.id
      const eventName = options.liveEventsMap.get(liveKey) ?? null
      live = !!eventName
      // Named alongside the flag so a caller can label the badge it just decided to show. Null
      // whenever `live` is false, so the two can never disagree.
      live_event_name = eventName
    }

    const result: AggregateDestinationAttributes & {
      connected_addresses?: string[] | null
      live?: boolean
      live_event_name?: string | null
    } = {
      ...destination,
      is_private: destination.is_private ?? false,
      user_visits: user_visits,
      user_count: finalUserCount,
    }

    // Checked against undefined, not truthiness, so an unknown reading is reported as null instead
    // of dropping the field and reading as "presence was never requested".
    if (connected_addresses !== undefined) {
      result.connected_addresses = connected_addresses
    }

    if (options?.withLiveEvents) {
      result.live = live ?? false
      result.live_event_name = live_event_name
    }

    return result
  })
}
