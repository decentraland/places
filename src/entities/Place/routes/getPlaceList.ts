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
import { getHotScenes } from "../../../modules/hotScenes"
import { getSceneStats } from "../../../modules/sceneStats"
import toCanonicalPosition from "../../../utils/position/toCanonicalPosition"
import PlaceModel from "../model"
import { getPlaceListQuerySchema } from "../schemas"
import {
  FindWithAggregatesOptions,
  GetPlaceListQuery,
  PlaceListOrderBy,
} from "../types"
import { placesWithUserCount, placesWithUserVisits } from "../utils"
import { getPlaceMostActiveList } from "./getPlaceMostActiveList"
import { getPlaceUserVisitsList } from "./getPlaceUserVisitsList"

export const validateGetPlaceListQuery = Router.validator<GetPlaceListQuery>(
  getPlaceListQuerySchema
)

export const getPlaceList = Router.memo(
  async (ctx: Context<{}, "url" | "request">) => {
    if (ctx.url.searchParams.get("order_by") === PlaceListOrderBy.MOST_ACTIVE) {
      return getPlaceMostActiveList(ctx)
    } else if (
      ctx.url.searchParams.get("order_by") === PlaceListOrderBy.USER_VISITS
    ) {
      return getPlaceUserVisitsList(ctx)
    }

    const query = await validateGetPlaceListQuery({
      positions: ctx.url.searchParams.getAll("positions"),
      offset: ctx.url.searchParams.get("offset"),
      limit: ctx.url.searchParams.get("limit"),
      only_favorites: ctx.url.searchParams.get("only_favorites"),
      only_featured: ctx.url.searchParams.get("only_featured"),
      only_highlighted: ctx.url.searchParams.get("only_highlighted"),
      order_by:
        oneOf(ctx.url.searchParams.get("order_by"), [
          PlaceListOrderBy.LIKE_SCORE_BEST,
          PlaceListOrderBy.UPDATED_AT,
          PlaceListOrderBy.CREATED_AT,
        ]) || PlaceListOrderBy.LIKE_SCORE_BEST,
      order:
        oneOf(ctx.url.searchParams.get("order"), ["asc", "desc"]) || "desc",
      with_realms_detail: ctx.url.searchParams.get("with_realms_detail"),
      search: ctx.url.searchParams.get("search"),
      categories: ctx.url.searchParams.getAll("categories"),
      owner: ctx.url.searchParams.get("owner")?.toLowerCase(),
    })

    const userAuth = await withAuthOptional(ctx)

    if (bool(query.only_favorites) && !userAuth?.address) {
      return new ApiResponse([], { total: 0 })
    }

    const options: FindWithAggregatesOptions = {
      user: userAuth?.address,
      offset: numeric(query.offset, { min: 0 }) ?? 0,
      limit: numeric(query.limit, { min: 0, max: 100 }) ?? 100,
      only_favorites: !!bool(query.only_favorites),
      only_highlighted: !!bool(query.only_highlighted),
      positions: query.positions,
      order_by: query.order_by,
      order: query.order,
      search: query.search,
      categories: query.categories,
      owner: query.owner,
    }

    // If owner parameter is provided, fetch operated lands from Catalyst API
    let operatedPositions: string[] = []

    if (query.owner) {
      try {
        const catalystAPI = CatalystAPI.get()
        const operatedLands = await catalystAPI.getOperatedLands(query.owner)

        if (operatedLands?.elements?.length > 0) {
          // Convert operated lands coordinates to canonical positions
          operatedPositions = operatedLands.elements
            .map((land) => toCanonicalPosition(`${land.x},${land.y}`))
            .filter(Boolean) as string[]
        }
      } catch (error) {
        console.error("Error fetching operated lands:", error)
        // Continue with normal flow even if Catalyst API fails
      }
    }

    // Add operatedPositions to options for enhanced query
    const enhancedOptions = {
      ...options,
      operatedPositions,
    }

    const [data, total, sceneStats] = await Promise.all([
      PlaceModel.findWithAggregates(enhancedOptions),
      PlaceModel.countPlaces(enhancedOptions),
      getSceneStats(),
    ])

    const hotScenes = getHotScenes()

    const response = placesWithUserVisits(
      placesWithUserCount(data, hotScenes, {
        withRealmsDetail: !!bool(query.with_realms_detail),
      }),
      sceneStats
    )

    return new ApiResponse(response, { total })
  }
)
