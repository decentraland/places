import isAdmin from "decentraland-gatsby/dist/entities/Auth/isAdmin"
import { withAuth } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import { AjvObjectSchema } from "decentraland-gatsby/dist/entities/Schema/types"

import { createWkcValidator } from "../../shared/validate"
import { notifyDisablePlaces } from "../../Slack/utils"
import PlaceModel from "../model"
import { getPlaceParamsSchema, updateDisabledBodySchema } from "../schemas"
import {
  AggregatePlaceAttributes,
  DisabledReason,
  GetPlaceParams,
  UpdateDisabledBody,
} from "../types"

const validateUpdateDisabledParams = createWkcValidator<GetPlaceParams>(
  getPlaceParamsSchema as AjvObjectSchema
)

const validateUpdateDisabledBody = createWkcValidator<UpdateDisabledBody>(
  updateDisabledBodySchema as AjvObjectSchema
)

export async function updateDisabled(
  ctx: Context<{ place_id: string }, "request" | "body" | "params">
): Promise<ApiResponse<AggregatePlaceAttributes, {}>> {
  const userAuth = await withAuth(ctx)
  const params = await validateUpdateDisabledParams(ctx.params)
  const body = await validateUpdateDisabledBody(ctx.body)

  if (!isAdmin(userAuth.address)) {
    throw new ErrorResponse(
      Response.Forbidden,
      `Only admin allowed to update disabled`
    )
  }

  const place = await PlaceModel.findByIdWithAggregates(params.place_id, {
    user: userAuth.address,
  })

  if (!place) {
    throw new ErrorResponse(
      Response.NotFound,
      `Not found place "${params.place_id}"`
    )
  }

  const now = new Date()
  const newPlace = {
    ...place,
    disabled: body.disabled,
    disabled_at: body.disabled ? now : null,
    disabled_reason: body.disabled ? DisabledReason.MODERATION : null,
    updated_at: now,
  }

  await PlaceModel.updateDisabled(
    params.place_id,
    body.disabled,
    body.disabled ? DisabledReason.MODERATION : null,
    now
  )

  if (body.disabled) {
    notifyDisablePlaces([newPlace])
  }

  return new ApiResponse(newPlace)
}
