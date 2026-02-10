import { withAuth } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"

import { fetchScore } from "../../Snapshot/utils"
import UserLikesModel from "../../UserLikes/model"
import { UserLikeAttributes } from "../../UserLikes/types"
import WorldModel from "../model"
import {
  updateWorldLikeBodySchema,
  updateWorldLikeParamsSchema,
} from "../schemas"

export type UpdateWorldLikeParams = {
  world_id: string
}

export type UpdateWorldLikeBody = {
  like: boolean | null
}

export const validateWorldLikeParams = Router.validator<UpdateWorldLikeParams>(
  updateWorldLikeParamsSchema
)

export const validateWorldLikeBody = Router.validator<UpdateWorldLikeBody>(
  updateWorldLikeBodySchema
)

export async function updateWorldLikes(
  ctx: Context<{ world_id: string }, "request" | "body" | "params">
) {
  const params = await validateWorldLikeParams(ctx.params)
  const body = await validateWorldLikeBody(ctx.body)
  const userAuth = await withAuth(ctx)

  const world = await WorldModel.findByIdWithAggregates(params.world_id, {
    user: userAuth.address,
  })

  if (!world) {
    throw new ErrorResponse(
      Response.NotFound,
      `Not found world "${params.world_id}"`
    )
  }

  const entityUserData = {
    entity_id: params.world_id,
    user: userAuth.address,
  }

  const userLike = await UserLikesModel.findOne<UserLikeAttributes>(
    entityUserData
  )

  if (userLike && userLike.like === body.like) {
    return new ApiResponse({
      likes: world.likes,
      dislikes: world.dislikes,
      user_like: world.user_like,
      user_dislike: world.user_dislike,
    })
  }

  if (body.like === null) {
    await UserLikesModel.delete(entityUserData)
  } else {
    const user_activity = await fetchScore(userAuth.address)
    await UserLikesModel.like(entityUserData, {
      like: body.like,
      user_activity,
    })
  }

  await WorldModel.updateLikes(params.world_id)

  const worldUpdated = await WorldModel.findByIdWithAggregates(
    params.world_id,
    {
      user: userAuth.address,
    }
  )

  return new ApiResponse({
    likes: worldUpdated!.likes,
    dislikes: worldUpdated!.dislikes,
    user_like: worldUpdated!.user_like,
    user_dislike: worldUpdated!.user_dislike,
  })
}
