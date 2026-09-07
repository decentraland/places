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

const ADMIN_TOKEN = env("PLACES_ADMIN_AUTH_TOKEN", "")

const requireAdminToken = withBearerToken({
  tokens: ADMIN_TOKEN ? [ADMIN_TOKEN] : [],
  optional: false,
})

const validateParams = createWkcValidator<GetPlaceParams>(
  getPlaceParamsSchema as AjvObjectSchema
)

async function setExcludeFromRanking(
  ctx: Context<{ place_id: string }, "request" | "params">,
  excludeFromRanking: boolean
): Promise<ApiResponse<AggregatePlaceAttributes, {}>> {
  await requireAdminToken(ctx)

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

  // The ranking goes with the flag: a value the score wrote earlier would otherwise freeze at
  // exactly the number we just decided not to trust. See WorldModel.updateExcludeFromRanking.
  const newPlace = {
    ...place,
    exclude_from_ranking: excludeFromRanking,
    ranking: excludeFromRanking ? 0 : place.ranking,
  }

  await PlaceModel.updatePlace(
    newPlace,
    excludeFromRanking
      ? ["exclude_from_ranking", "ranking"]
      : ["exclude_from_ranking"]
  )

  return new ApiResponse(newPlace)
}

export function excludePlaceFromRanking(
  ctx: Context<{ place_id: string }, "request" | "params">
): Promise<ApiResponse<AggregatePlaceAttributes, {}>> {
  return setExcludeFromRanking(ctx, true)
}

export function includePlaceInRanking(
  ctx: Context<{ place_id: string }, "request" | "params">
): Promise<ApiResponse<AggregatePlaceAttributes, {}>> {
  return setExcludeFromRanking(ctx, false)
}
