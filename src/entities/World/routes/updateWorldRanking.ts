import withBearerToken from "decentraland-gatsby/dist/entities/Auth/routes/withBearerToken"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import { AjvObjectSchema } from "decentraland-gatsby/dist/entities/Schema/types"
import env from "decentraland-gatsby/dist/utils/env"

import { createWkcValidator } from "../../shared/validate"
import WorldModel from "../model"
import {
  updateWorldRankingParamsSchema,
  updateWorldRankingBodySchema,
} from "../schemas"
import {
  AggregateWorldAttributes,
  GetWorldParams,
  UpdateWorldRankingBody,
} from "../types"

const validateParams = createWkcValidator<GetWorldParams>(
  updateWorldRankingParamsSchema as AjvObjectSchema
)

const validateBody = createWkcValidator<UpdateWorldRankingBody>(
  updateWorldRankingBodySchema as AjvObjectSchema
)

export async function updateWorldRanking(
  ctx: Context<{ world_id: string }, "request" | "body" | "params">
): Promise<ApiResponse<AggregateWorldAttributes, {}>> {
  const token = env("DATA_TEAM_AUTH_TOKEN", "")
  await withBearerToken({ tokens: token ? [token] : [], optional: false })(ctx)

  const params = await validateParams(ctx.params)
  const body = await validateBody(ctx.body)

  const world = await WorldModel.findByIdWithAggregates(params.world_id, {
    user: undefined,
  })

  if (!world) {
    throw new ErrorResponse(
      Response.NotFound,
      `Not found world "${params.world_id}"`
    )
  }

  await WorldModel.updateRanking(params.world_id, body.ranking)

  const updatedWorld: AggregateWorldAttributes = {
    ...world,
    ranking: body.ranking,
  }

  return new ApiResponse(updatedWorld)
}
