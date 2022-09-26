import { withAuthOptional } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"
import { bool, numeric } from "decentraland-gatsby/dist/entities/Schema/utils"

import PlaceModel from "../model"
import { getPlaceListQuerySchema } from "../schemas"
import {
  FindWithAggregatesOptions,
  GetPlaceListQuery,
  PlaceListOrderBy,
} from "../types"

export const validateGetPlaceListQuery = Router.validator<GetPlaceListQuery>(
  getPlaceListQuerySchema
)

export const getPlaceList = Router.memo(
  async (ctx: Context<{}, "url" | "request">) => {
    const query = await validateGetPlaceListQuery({
      positions: ctx.url.searchParams.getAll("positions"),
      offset: ctx.url.searchParams.get("offset"),
      limit: ctx.url.searchParams.get("limit"),
      onlyFavorites: ctx.url.searchParams.get("onlyFavorites"),
      orderBy:
        ctx.url.searchParams.get("orderBy") || PlaceListOrderBy.UPDATED_AT,
      order: ctx.url.searchParams.get("order") || "desc",
    })

    const userAuth = await withAuthOptional(ctx)

    if (bool(query.onlyFavorites) && !userAuth?.address) {
      return new ApiResponse([], { total: 0 })
    }
    const options: FindWithAggregatesOptions = {
      user: userAuth?.address,
      offset: numeric(query.offset, { min: 0 }),
      limit: numeric(query.limit, { min: 0, max: 100 }),
      onlyFavorites: !!bool(query.onlyFavorites),
      positions: query.positions,
      orderBy: query.orderBy,
      order: query.order,
    }

    const [data, total] = await Promise.all([
      PlaceModel.findWithAggregates(options),
      PlaceModel.countPlaces(options),
    ])

    return new ApiResponse(data, { total })
  }
)
