import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import { AjvObjectSchema } from "decentraland-gatsby/dist/entities/Schema/types"

import {
  isAdminToken,
  requireAdminTokenForCuratedRanking,
  requireRankingToken,
} from "../../shared/auth"
import { createWkcValidator } from "../../shared/validate"
import PlaceModel from "../model"
import { getPlaceParamsSchema, updateRankingBodySchema } from "../schemas"
import {
  AggregatePlaceAttributes,
  GetPlaceParams,
  UpdateRankingBody,
} from "../types"

const validateUpdateRankingParams = createWkcValidator<GetPlaceParams>(
  getPlaceParamsSchema as AjvObjectSchema
)

const validateUpdateRankingBody = createWkcValidator<UpdateRankingBody>(
  updateRankingBodySchema as AjvObjectSchema
)

export async function updateRanking(
  ctx: Context<{ place_id: string }, "request" | "body" | "params">
): Promise<ApiResponse<AggregatePlaceAttributes, {}>> {
  const token = await requireRankingToken(ctx)

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

  requireAdminTokenForCuratedRanking(token, {
    highlighted: place.highlighted,
    exclude_from_ranking: place.exclude_from_ranking,
  })

  const newPlace = { ...place, ranking: body.ranking }

  if (isAdminToken(token)) {
    await PlaceModel.updatePlace(newPlace, ["ranking"])

    return new ApiResponse(newPlace)
  }

  // The check above read the row; this writes it. An admin curating the place in between would
  // otherwise slip through, so the automated path carries the condition into the statement and
  // refuses when it wrote nothing.
  const written = await PlaceModel.updateRankingFromScore(place, body.ranking)

  if (written === 0) {
    throw new ErrorResponse(
      Response.Forbidden,
      "The ranking of this place is editorial and can only be changed with the admin token"
    )
  }

  return new ApiResponse(newPlace)
}
