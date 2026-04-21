import withBearerToken from "decentraland-gatsby/dist/entities/Auth/routes/withBearerToken"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import { AjvObjectSchema } from "decentraland-gatsby/dist/entities/Schema/types"
import env from "decentraland-gatsby/dist/utils/env"

import { createWkcValidator } from "../../shared/validate"
import PlaceModel from "../model"
import { getPlaceParamsSchema } from "../schemas"
import { AggregatePlaceAttributes, GetPlaceParams } from "../types"

const validateParams = createWkcValidator<GetPlaceParams>(
  getPlaceParamsSchema as AjvObjectSchema
)

export async function featured(
  ctx: Context<{ place_id: string }, "request" | "params">
): Promise<ApiResponse<AggregatePlaceAttributes, {}>> {
  const token = env("PLACES_ADMIN_AUTH_TOKEN", "")
  await withBearerToken({ tokens: token ? [token] : [], optional: false })(ctx)

  const params = await validateParams(ctx.params)

  const place = await PlaceModel.findByIdWithAggregates(params.place_id, {
    user: undefined,
  })

  if (!place) {
    throw new ErrorResponse(
      Response.NotFound,
      `Not found place "${params.place_id}"`
    )
  }

  const highlighted = ctx.request.method.toUpperCase() === "PUT"
  const newPlace = { ...place, highlighted }
  await PlaceModel.updatePlace(newPlace, ["highlighted"])

  return new ApiResponse(newPlace)
}
