import { withAuth } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"

import { findEntityByIdWithAggregates } from "../../shared/entityInteractions"
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

  const entity = await findEntityByIdWithAggregates(params.world_id, {
    user: userAuth.address,
  })

  if (!entity) {
    throw new ErrorResponse(
      Response.NotFound,
      `Not found entity "${params.world_id}"`
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
      likes: entity.likes,
      dislikes: entity.dislikes,
      user_like: entity.user_like,
      user_dislike: entity.user_dislike,
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

  const refreshed = await findEntityByIdWithAggregates(params.world_id, {
    user: userAuth.address,
  })

  return new ApiResponse({
    likes: refreshed!.likes,
    dislikes: refreshed!.dislikes,
    user_like: refreshed!.user_like,
    user_dislike: refreshed!.user_dislike,
  })
}
