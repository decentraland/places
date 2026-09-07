import withBearerToken from "decentraland-gatsby/dist/entities/Auth/routes/withBearerToken"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import { AjvObjectSchema } from "decentraland-gatsby/dist/entities/Schema/types"
import env from "decentraland-gatsby/dist/utils/env"

import { createWkcValidator } from "../../shared/validate"
import WorldModel from "../model"
import { getWorldParamsSchema } from "../schemas"
import { AggregateWorldAttributes, GetWorldParams } from "../types"

const ADMIN_TOKEN = env("PLACES_ADMIN_AUTH_TOKEN", "")

const requireAdminToken = withBearerToken({
  tokens: ADMIN_TOKEN ? [ADMIN_TOKEN] : [],
  optional: false,
})

const validateParams = createWkcValidator<GetWorldParams>(
  getWorldParamsSchema as AjvObjectSchema
)

async function setExcludeFromRanking(
  ctx: Context<{ world_id: string }, "request" | "params">,
  excludeFromRanking: boolean
): Promise<ApiResponse<AggregateWorldAttributes, {}>> {
  await requireAdminToken(ctx)

  const params = await validateParams(ctx.params)

  const world = await WorldModel.findByIdWithAggregates(params.world_id, {
    user: undefined,
  })

  if (!world) {
    throw new ErrorResponse(
      Response.NotFound,
      `Not found world "${params.world_id}"`
    )
  }

  await WorldModel.updateExcludeFromRanking(params.world_id, excludeFromRanking)

  return new ApiResponse({
    ...world,
    exclude_from_ranking: excludeFromRanking,
    ranking: excludeFromRanking ? 0 : world.ranking,
  })
}

export function excludeWorldFromRanking(
  ctx: Context<{ world_id: string }, "request" | "params">
): Promise<ApiResponse<AggregateWorldAttributes, {}>> {
  return setExcludeFromRanking(ctx, true)
}

export function includeWorldInRanking(
  ctx: Context<{ world_id: string }, "request" | "params">
): Promise<ApiResponse<AggregateWorldAttributes, {}>> {
  return setExcludeFromRanking(ctx, false)
}
