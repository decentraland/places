import { withAuthOptional } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"
import {
  bool,
  numeric,
  oneOf,
} from "decentraland-gatsby/dist/entities/Schema/utils"

import CatalystAPI from "../../../api/CatalystAPI"
import { getHotScenes } from "../../../modules/hotScenes"
import { getSceneStats } from "../../../modules/sceneStats"
import PlaceModel from "../../Place/model"
import { Permission, PlaceListOrderBy } from "../../Place/types"
import { getWorldsLiveData } from "../../World/utils"
import { getDestinationsListQuerySchema } from "../schemas"
import {
  FindDestinationsWithAggregatesOptions,
  GetDestinationsListQuery,
} from "../types"
import {
  ConnectedUsersMap,
  LiveEventsMap,
  destinationsWithAggregates,
  fetchConnectedUsersForDestinations,
  fetchLiveEventsForDestinations,
} from "../utils"

export const validateGetDestinationsListQuery =
  Router.validator<GetDestinationsListQuery>(getDestinationsListQuerySchema)

export const getDestinationsListById = Router.memo(
  async (ctx: Context<{}, "url" | "request" | "body">) => {
    const destinationIds = ctx.body

    if (!Array.isArray(destinationIds)) {
      throw new ErrorResponse(
        Response.BadRequest,
        `Invalid request body. Expected an array of destination IDs.`
      )
    }

    if (destinationIds.length > 100) {
      throw new ErrorResponse(
        Response.BadRequest,
        `Cannot request more than 100 destinations at once`
      )
    }

    const query = await validateGetDestinationsListQuery({
      pointer: ctx.url.searchParams.getAll("pointer"),
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
      with_live_events: ctx.url.searchParams.get("with_live_events"),
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
      positions: query.pointer,
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
      ids: destinationIds,
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

    // Fetch live events if requested
    const withLiveEvents = !!bool(query.with_live_events)
    let liveEventsMap: LiveEventsMap | undefined

    if (withLiveEvents && data.length > 0) {
      liveEventsMap = await fetchLiveEventsForDestinations(data)
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
        withLiveEvents,
        liveEventsMap,
      }
    )

    return new ApiResponse(response, { total })
  }
)
