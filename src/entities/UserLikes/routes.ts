import { withAuth } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import routes from "decentraland-gatsby/dist/entities/Route/wkc/routes"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"

import { updateUserLikeBodySchema, updateUserLikeParamsSchema } from "./schema"
import {
  UpdateUserLikeBody,
  UpdateUserLikeParams,
  UserLikeAttributes,
} from "./types"
import PlaceModel from "../Place/model"
import { findEntityByIdWithAggregates } from "../shared/entityInteractions"
import { isWorld } from "../shared/entityTypes"
import { fetchScore } from "../Snapshot/utils"
import UserLikesModel from "../UserLikes/model"
import WorldModel from "../World/model"

export default routes((router) => {
  router.patch("/places/:entity_id/likes", updateLike)
})

export const validateGetPlaceParams = Router.validator<UpdateUserLikeParams>(
  updateUserLikeParamsSchema
)

export const validateGetPlaceBody = Router.validator<UpdateUserLikeBody>(
  updateUserLikeBodySchema
)

// This endpoint is under /places/ but also handles world entities for
// retro-compatibility. The dedicated /worlds/:world_id/likes endpoint
// exists for world likes, but older clients may still send world IDs
// through this endpoint, so we look up both places and worlds here.
export async function updateLike(
  ctx: Context<{ entity_id: string }, "request" | "body" | "params">
) {
  const params = await validateGetPlaceParams(ctx.params)
  const body = await validateGetPlaceBody(ctx.body)
  const userAuth = await withAuth(ctx)

  const entity = await findEntityByIdWithAggregates(params.entity_id, {
    user: userAuth.address,
  })

  if (!entity) {
    throw new ErrorResponse(
      Response.NotFound,
      `Not found entity "${params.entity_id}"`
    )
  }

  const entityUserData = {
    entity_id: params.entity_id,
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
    // TODO(#319): if the snapshot fetching fails, the like is stored as if the user doesn't have enough VP.
    // this should be retried or turned into a SQL tx to be able to rollback  if this fails
    const user_activity = await fetchScore(userAuth.address)
    await UserLikesModel.like(entityUserData, {
      like: body.like,
      user_activity,
    })
  }

  if (isWorld(entity)) {
    await WorldModel.updateLikes(params.entity_id)
  } else {
    await PlaceModel.updateLikes(params.entity_id)
  }

  const refreshed = await findEntityByIdWithAggregates(params.entity_id, {
    user: userAuth.address,
  })

  return new ApiResponse({
    likes: refreshed!.likes,
    dislikes: refreshed!.dislikes,
    user_like: refreshed!.user_like,
    user_dislike: refreshed!.user_dislike,
  })
}
