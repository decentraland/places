import { withAuthOptional } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"
import {
  bool,
  numeric,
  oneOf,
} from "decentraland-gatsby/dist/entities/Schema/utils"

import { getEntityScenes } from "../../../modules/entityScene"
import { getHotScenes } from "../../../modules/hotScenes"
import { getSceneStats } from "../../../modules/sceneStats"
import PlaceModel from "../model"
import { getPlaceListQuerySchema } from "../schemas"
import {
  FindWithAggregatesOptions,
  GetPlaceListQuery,
  PlaceListOrderBy,
} from "../types"
import {
  placesWithLastUpdate,
  placesWithUserCount,
  placesWithUserVisits,
} from "../utils"
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
          PlaceListOrderBy.HIGHEST_RATED,
          PlaceListOrderBy.UPDATED_AT,
        ]) || PlaceListOrderBy.HIGHEST_RATED,
      order:
        oneOf(ctx.url.searchParams.get("order"), ["asc", "desc"]) || "desc",
      with_realms_detail: ctx.url.searchParams.get("with_realms_detail"),
    })

    const userAuth = await withAuthOptional(ctx)

    if (bool(query.only_favorites) && !userAuth?.address) {
      return new ApiResponse([], { total: 0 })
    }
    const options: FindWithAggregatesOptions = {
      user: userAuth?.address,
      offset: numeric(query.offset, { min: 0 }),
      limit: numeric(query.limit, { min: 0, max: 100 }),
      only_favorites: !!bool(query.only_favorites),
      only_featured: !!bool(query.only_featured),
      only_highlighted: !!bool(query.only_highlighted),
      positions: query.positions,
      order_by: query.order_by,
      order: query.order,
    }

    const [data, total, hotScenes, sceneStats] = await Promise.all([
      PlaceModel.findWithAggregates(options),
      PlaceModel.countPlaces(options),
      getHotScenes(),
      getSceneStats(),
    ])

    const entityScene = await getEntityScenes(
      data.map((place) => place.base_position)
    )

    return new ApiResponse(
      placesWithLastUpdate(
        placesWithUserVisits(
          placesWithUserCount(data, hotScenes, {
            withRealmsDetail: !!bool(query.with_realms_detail),
          }),
          sceneStats
        ),
        entityScene
      ),
      { total }
    )
  }
)
