import isAdmin from "decentraland-gatsby/dist/entities/Auth/isAdmin"
import { withAuth } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import { AjvObjectSchema } from "decentraland-gatsby/dist/entities/Schema/types"

import { createWkcValidator } from "../../shared/validate"
import WorldModel from "../model"
import {
  updateWorldHighlightBodySchema,
  updateWorldHighlightParamsSchema,
} from "../schemas"
import {
  AggregateWorldAttributes,
  GetWorldParams,
  UpdateWorldHighlightBody,
} from "../types"

const validateParams = createWkcValidator<GetWorldParams>(
  updateWorldHighlightParamsSchema as AjvObjectSchema
)

const validateBody = createWkcValidator<UpdateWorldHighlightBody>(
  updateWorldHighlightBodySchema as AjvObjectSchema
)

export async function updateWorldHighlight(
  ctx: Context<{ world_id: string }, "request" | "body" | "params">
): Promise<ApiResponse<AggregateWorldAttributes, {}>> {
  const userAuth = await withAuth(ctx)
  const params = await validateParams(ctx.params)
  const body = await validateBody(ctx.body)

  if (!isAdmin(userAuth.address)) {
    throw new ErrorResponse(
      Response.Forbidden,
      `Only admin allowed to update highlight`
    )
  }

  const world = await WorldModel.findByIdWithAggregates(params.world_id, {
    user: userAuth.address,
  })

  if (!world) {
    throw new ErrorResponse(
      Response.NotFound,
      `Not found world "${params.world_id}"`
    )
  }

  await WorldModel.updateHighlighted(params.world_id, body.highlighted)

  const updatedWorld: AggregateWorldAttributes = {
    ...world,
    highlighted: body.highlighted,
  }

  return new ApiResponse(updatedWorld)
}
