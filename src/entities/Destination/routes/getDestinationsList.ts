import { withAuthOptional } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"
import {
  bool,
  numeric,
  oneOf,
} from "decentraland-gatsby/dist/entities/Schema/utils"

import CatalystAPI from "../../../api/CatalystAPI"
import CommsGatekeeper from "../../../api/CommsGatekeeper"
import { getHotScenes } from "../../../modules/hotScenes"
import { getSceneStats } from "../../../modules/sceneStats"
import PlaceModel from "../../Place/model"
import {
  AggregatePlaceAttributes,
  Permission,
  PlaceListOrderBy,
} from "../../Place/types"
import { getWorldsLiveData } from "../../World/utils"
import { getDestinationsListQuerySchema } from "../schemas"
import {
  FindDestinationsWithAggregatesOptions,
  GetDestinationsListQuery,
} from "../types"
import { ConnectedUsersMap, destinationsWithAggregates } from "../utils"

/**
 * Fetches connected users for a list of destinations from comms-gatekeeper.
 * Returns a map where keys are pointer/parcel (for places) or world_name (for worlds),
 * and values are arrays of wallet addresses.
 */
async function fetchConnectedUsersForDestinations(
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
        .getWorldRoomParticipants(world.world_name!)
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
        .getSceneRoomParticipants(place.base_position)
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

export const validateGetDestinationsListQuery =
  Router.validator<GetDestinationsListQuery>(getDestinationsListQuerySchema)

export const getDestinationsList = Router.memo(
  async (ctx: Context<{}, "url" | "request">) => {
    const query = await validateGetDestinationsListQuery({
      positions: ctx.url.searchParams.getAll("positions"),
      world_names: ctx.url.searchParams.getAll("world_names"),
      names: ctx.url.searchParams.getAll("names"),
      offset: ctx.url.searchParams.get("offset"),
      limit: ctx.url.searchParams.get("limit"),
      only_favorites: ctx.url.searchParams.get("only_favorites"),
      only_highlighted: ctx.url.searchParams.get("only_highlighted"),
      order_by:
        oneOf(ctx.url.searchParams.get("order_by"), [
          PlaceListOrderBy.LIKE_SCORE_BEST,
          PlaceListOrderBy.MOST_ACTIVE,
          PlaceListOrderBy.UPDATED_AT,
          PlaceListOrderBy.CREATED_AT,
        ]) || PlaceListOrderBy.LIKE_SCORE_BEST,
      order:
        oneOf(ctx.url.searchParams.get("order"), ["asc", "desc"]) || "desc",
      with_realms_detail: ctx.url.searchParams.get("with_realms_detail"),
      with_connected_users: ctx.url.searchParams.get("with_connected_users"),
      search: ctx.url.searchParams.get("search"),
      categories: ctx.url.searchParams.getAll("categories"),
      owner: ctx.url.searchParams.get("owner")?.toLowerCase(),
      creator_address: ctx.url.searchParams
        .get("creator_address")
        ?.toLowerCase(),
      only_worlds: ctx.url.searchParams.get("only_worlds"),
      only_places: ctx.url.searchParams.get("only_places"),
      sdk: ctx.url.searchParams.get("sdk"),
    })

    const userAuth = await withAuthOptional(ctx)

    if (bool(query.only_favorites) && !userAuth?.address) {
      return new ApiResponse([], { total: 0 })
    }

    const hotScenes = getHotScenes()

    const options: FindDestinationsWithAggregatesOptions = {
      user: userAuth?.address,
      offset: numeric(query.offset, { min: 0 }) ?? 0,
      limit: numeric(query.limit, { min: 0, max: 100 }) ?? 100,
      only_favorites: !!bool(query.only_favorites),
      only_highlighted: !!bool(query.only_highlighted),
      positions: query.positions,
      world_names: query.world_names,
      names: query.names,
      order_by: query.order_by,
      order: query.order,
      search: query.search,
      categories: query.categories,
      owner: query.owner,
      creator_address: query.creator_address,
      only_worlds: !!bool(query.only_worlds),
      only_places: !!bool(query.only_places),
      sdk: query.sdk,
    }

    // If owner parameter is provided, fetch operated lands from Catalyst API
    let operatedPositions: string[] = []

    if (query.owner) {
      try {
        const catalystAPI = CatalystAPI.get()
        const operatedLands = await catalystAPI.getAllOperatedLands(query.owner)

        if (operatedLands && operatedLands.length > 0) {
          operatedPositions = operatedLands
            .map((land: Permission) => `${land.x},${land.y}`)
            .filter(Boolean) as string[]
        }
      } catch (error) {
        console.error("Error fetching operated lands:", error)
        // Continue with normal flow even if Catalyst API fails
      }
    }

    // Get positions from hot scenes for MOST_ACTIVE ordering
    const hotScenesPositions =
      query.order_by === PlaceListOrderBy.MOST_ACTIVE
        ? hotScenes
            .map((scene) => scene.parcels.map((parcel) => parcel.join(",")))
            .flat()
        : []

    // Add operatedPositions and hotScenesPositions to options for enhanced query
    const enhancedOptions = {
      ...options,
      operatedPositions,
      hotScenesPositions,
    }

    const [data, total, sceneStats] = await Promise.all([
      PlaceModel.findDestinationsWithAggregates(enhancedOptions),
      PlaceModel.countDestinations(enhancedOptions),
      getSceneStats(),
    ])
    const worldsLiveData = getWorldsLiveData()

    // Fetch connected users if requested
    const withConnectedUsers = !!bool(query.with_connected_users)
    let connectedUsersMap: ConnectedUsersMap | undefined

    if (withConnectedUsers && data.length > 0) {
      connectedUsersMap = await fetchConnectedUsersForDestinations(data)
    }

    const response = destinationsWithAggregates(
      data,
      hotScenes,
      sceneStats,
      worldsLiveData,
      {
        withRealmsDetail: !!bool(query.with_realms_detail),
        withConnectedUsers,
        connectedUsersMap,
      }
    )

    return new ApiResponse(response, { total })
  }
)
