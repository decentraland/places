import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"

import PlaceModel from "../model"
import { getPlaceParamsSchema } from "../schemas"
import { GetPlaceParams, PlaceAttributes } from "../types"

export const validateGetPlaceParams = Router.validator<GetPlaceParams>(getPlaceParamsSchema)

export const getPlace = Router.memo(
  async (ctx: Pick<Context<{ place_id: string }>, "params">) => {
    const params = await validateGetPlaceParams(ctx.params)
    const place = await PlaceModel.findOne<PlaceAttributes>({
      id: params.place_id,
    })

    if (!place) {
      throw new ErrorResponse(
        Response.NotFound,
        `Not found place "${params.place_id}"`
      )
    }

    return new ApiResponse(place)
  }
)
