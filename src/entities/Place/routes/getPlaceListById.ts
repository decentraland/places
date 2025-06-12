import { withAuthOptional } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"
import { numeric, oneOf } from "decentraland-gatsby/dist/entities/Schema/utils"

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

export const getPlaceListById = Router.memo(async (ctx: Context) => {
  const placeIds = ctx.body

  if (!Array.isArray(placeIds)) {
    throw new ErrorResponse(
      Response.BadRequest,
      `Invalid request body. Expected an array of place IDs.`
    )
  }

  if (placeIds.length > 100) {
    throw new ErrorResponse(
      Response.BadRequest,
      `Cannot request more than 100 places at once`
    )
  }

  const query = await validateGetPlaceListQuery({
    offset: ctx.url.searchParams.get("offset"),
    limit: ctx.url.searchParams.get("limit"),
    order_by:
      oneOf(ctx.url.searchParams.get("order_by"), [
        PlaceListOrderBy.LIKE_SCORE_BEST,
        PlaceListOrderBy.UPDATED_AT,
        PlaceListOrderBy.CREATED_AT,
      ]) || PlaceListOrderBy.LIKE_SCORE_BEST,
    order: oneOf(ctx.url.searchParams.get("order"), ["asc", "desc"]) || "desc",
    search: ctx.url.searchParams.get("search"),
  })

  const userAuth = await withAuthOptional(ctx)

  const options: FindWithAggregatesOptions = {
    user: userAuth?.address,
    offset: numeric(query.offset, { min: 0 }) ?? 0,
    limit: numeric(query.limit, { min: 0, max: 100 }) ?? 100,
    only_favorites: false,
    only_highlighted: false,
    positions: [],
    categories: [],
    order_by: query.order_by,
    order: query.order,
    search: query.search,
    ids: placeIds,
  }

  const [places, total] = await Promise.all([
    PlaceModel.findWithAggregates(options),
    PlaceModel.countByIds(placeIds),
  ])

  return new ApiResponse(places, { total })
})
