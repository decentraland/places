import withBearerToken from "decentraland-gatsby/dist/entities/Auth/routes/withBearerToken"
import { createValidator } from "decentraland-gatsby/dist/entities/Route/validate"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import { AjvObjectSchema } from "decentraland-gatsby/dist/entities/Schema/types"
import env from "decentraland-gatsby/dist/utils/env"

import PlaceModel from "../model"
import { getPlaceParamsSchema, updateRankingBodySchema } from "../schemas"
import {
  AggregatePlaceAttributes,
  GetPlaceParams,
  UpdateRankingBody,
} from "../types"

const validateUpdateRankingParams = createValidator<GetPlaceParams>(
  getPlaceParamsSchema as AjvObjectSchema
)

const validateUpdateRankingBody = createValidator<UpdateRankingBody>(
  updateRankingBodySchema as AjvObjectSchema
)

export async function updateRanking(
  ctx: Context<{ place_id: string }, "request" | "body" | "params">
): Promise<ApiResponse<AggregatePlaceAttributes, {}>> {
  const token = env("DATA_TEAM_AUTH_TOKEN", "")
  await withBearerToken({ tokens: token ? [token] : [] })(ctx)

  const params = await validateUpdateRankingParams(ctx.params)
  const body = await validateUpdateRankingBody(ctx.body)

  const place = await PlaceModel.findByIdWithAggregates(params.place_id, {
    user: undefined,
  })

  if (!place) {
    throw new ErrorResponse(
      Response.NotFound,
      `Not found place "${params.place_id}"`
    )
  }

  const newPlace = { ...place, ranking: body.ranking }
  await PlaceModel.updatePlace(newPlace, ["ranking"])

  return new ApiResponse(newPlace)
}
