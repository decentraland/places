import { withAuthOptional } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"
import {
  bool,
  numeric,
  oneOf,
} from "decentraland-gatsby/dist/entities/Schema/utils"

import PlaceModel from "../../Place/model"
import { getPlaceListQuerySchema } from "../../Place/schemas"
import {
  FindWithAggregatesOptions,
  GetPlaceListQuery,
  PlaceListOrderBy,
} from "../../Place/types"
import { getHotScenes } from "../../RealmProvider/utils"
import { getSceneStats } from "../../SceneStats/utils"
import { DEFAULT_MAX_LIMIT } from "../types"
import { placesWithCoordinatesAggregates } from "../utils"
import { getMapPlacesMostActive } from "./getMapPlacesMostActive"

export const validateGetPlaceListQuery = Router.validator<GetPlaceListQuery>(
  getPlaceListQuerySchema
)

export const getMapPlaces = Router.memo(
  async (ctx: Context<{}, "url" | "request">) => {
    if (ctx.url.searchParams.get("order_by") === PlaceListOrderBy.MOST_ACTIVE) {
      return getMapPlacesMostActive(ctx)
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
    })

    const userAuth = await withAuthOptional(ctx)

    if (bool(query.only_favorites) && !userAuth?.address) {
      return new ApiResponse([], { total: 0 })
    }

    const options: FindWithAggregatesOptions = {
      user: userAuth?.address,
      offset: numeric(query.offset, { min: 0 }) ?? 0,
      limit:
        numeric(query.limit, { min: 0, max: DEFAULT_MAX_LIMIT }) ??
        DEFAULT_MAX_LIMIT,
      only_favorites: !!bool(query.only_favorites),
      only_highlighted: !!bool(query.only_highlighted),
      positions: query.positions,
      order_by: query.order_by,
      order: query.order,
      search: query.search,
      categories: query.categories,
    }

    const [data, total, sceneStats] = await Promise.all([
      PlaceModel.findWithCoordinatesAggregates(options),
      PlaceModel.countPlacesWithCoordinatesAggregates(options),
      getSceneStats(),
    ])

    const hotScenes = getHotScenes()

    const response = placesWithCoordinatesAggregates(
      data,
      hotScenes,
      sceneStats,
      {
        withRealmsDetail: !!bool(query.with_realms_detail),
      }
    )

    return new ApiResponse(response, { total })
  }
)
