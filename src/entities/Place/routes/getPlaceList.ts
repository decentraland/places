import { withAuthOptional } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"

import PlaceModel from "../model"
import { getPlaceListQuerySchema } from "../schemas"
import {
  AggregatePlaceAttributes,
  GetPlaceListQuery,
  PlaceListOptions,
} from "../types"

export const validategetPlaceListQuery = Router.validator<GetPlaceListQuery>(
  getPlaceListQuerySchema
)

export const getPlaceList = Router.memo(
  async (
    ctx: Context<{ place_id: string }, "query" | "request">
  ): Promise<
    ApiResponse<
      { total: number; data: AggregatePlaceAttributes[] },
      { total: 0; data: [] }
    >
  > => {
    const query = await validategetPlaceListQuery(ctx.query)
    const userAuth = await withAuthOptional(ctx)

    if (query.onlyFavorites && !userAuth?.address) {
      return new ApiResponse({ total: 0, data: [] })
    }
    console.log(query.positions)
    const options: PlaceListOptions = {
      user: userAuth?.address,
      offset: query.offset ? Math.max(Number(query.offset), 0) : 0,
      limit: query.limit
        ? Math.min(Math.max(Number(query.limit), 0), 100)
        : 100,
      onlyFavorites: !!query.onlyFavorites,
      positions: query.positions,
      orderBy: query.orderBy,
      order: query.order,
    }

    const [data, total] = await Promise.all([
      PlaceModel.findWithAggregates(options),
      PlaceModel.countPlaces(options),
    ])

    return new ApiResponse({ total, data })
  }
)
