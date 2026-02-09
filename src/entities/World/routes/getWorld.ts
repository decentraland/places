import { withAuthOptional } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"

import WorldModel from "../model"
import { getWorldParamsSchema } from "../schemas"
import { AggregateWorldAttributes, GetWorldParams } from "../types"
import { getWorldsLiveData, worldsWithUserCount } from "../utils"

export const validateGetWorldParams =
  Router.validator<GetWorldParams>(getWorldParamsSchema)

export const getWorld = Router.memo(
  async (
    ctx: Context<{ world_id: string }, "params" | "url" | "request">
  ): Promise<ApiResponse<AggregateWorldAttributes, {}>> => {
    const params = await validateGetWorldParams(ctx.params)
    const userAuth = await withAuthOptional(ctx)

    const world = await WorldModel.findByIdWithAggregates(params.world_id, {
      user: userAuth?.address,
    })

    if (!world) {
      throw new ErrorResponse(
        Response.NotFound,
        `Not found world "${params.world_id}"`
      )
    }

    const worldsLiveData = getWorldsLiveData()
    let aggregatedWorlds = [world]
    aggregatedWorlds = worldsWithUserCount(
      aggregatedWorlds,
      worldsLiveData.perWorld || []
    )

    return new ApiResponse(aggregatedWorlds[0])
  }
)
