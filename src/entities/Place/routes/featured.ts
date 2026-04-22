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

// The `/featured` endpoints toggle the `highlighted` DB column, renamed from
// `featured` to `highlighted` in migration 1667844930518_add-highlighted.ts.
async function setHighlighted(
  ctx: Context<{ place_id: string }, "request" | "params">,
  highlighted: boolean
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

  const newPlace = { ...place, highlighted }
  await PlaceModel.updatePlace(newPlace, ["highlighted"])

  return new ApiResponse(newPlace)
}

export function featurePlace(
  ctx: Context<{ place_id: string }, "request" | "params">
): Promise<ApiResponse<AggregatePlaceAttributes, {}>> {
  return setHighlighted(ctx, true)
}

export function unfeaturePlace(
  ctx: Context<{ place_id: string }, "request" | "params">
): Promise<ApiResponse<AggregatePlaceAttributes, {}>> {
  return setHighlighted(ctx, false)
}
