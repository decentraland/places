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
      only_favorites: ctx.url.searchParams.get("only_favorites"),
      order_by:
        ctx.url.searchParams.get("order_by") || PlaceListOrderBy.UPDATED_AT,
      order: ctx.url.searchParams.get("order") || "desc",
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
      positions: query.positions,
      order_by: query.order_by,
      order: query.order,
    }

    const [data, total] = await Promise.all([
      PlaceModel.findWithAggregates(options),
      PlaceModel.countPlaces(options),
    ])

    return new ApiResponse(data, { total })
  }
)
