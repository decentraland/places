import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"

import PlaceModel from "../model"
import { getPlaceListQuerySchema } from "../schemas"
import { GetPlaceListQuery } from "../types"

export const validateGetPlaceListQuery = Router.validator<GetPlaceListQuery>(
  getPlaceListQuerySchema
)

export const getPlaceStatusListById = Router.memo(
  async (ctx: Context<{}, "url" | "request" | "params" | "body">) => {
    const placeIds = ctx.body as string[]
    if (placeIds.length > 100) {
      throw new ErrorResponse(
        Response.NotFound,
        `Cannot request more than 100 places at once`
      )
    }

    const [places, total] = await Promise.all([
      PlaceModel.findByIds(placeIds),
      PlaceModel.countByIds(placeIds),
    ])

    return new ApiResponse(places, { total })
  }
)
