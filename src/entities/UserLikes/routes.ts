import { withAuth } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import routes from "decentraland-gatsby/dist/entities/Route/wkc/routes"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"

import PlaceModel from "../Place/model"
import { fetchScore } from "../Snapshot/utils"
import UserLikesModel from "../UserLikes/model"
import { updateUserLikeBodySchema, updateUserLikeParamsSchema } from "./schema"
import {
  UpdateUserLikeBody,
  UpdateUserLikeParams,
  UserLikeAttributes,
} from "./types"

export default routes((router) => {
  router.patch("/places/:place_id/likes", updateLike)
})

export const validateGetPlaceParams = Router.validator<UpdateUserLikeParams>(
  updateUserLikeParamsSchema
)

export const validateGetPlaceBody = Router.validator<UpdateUserLikeBody>(
  updateUserLikeBodySchema
)

async function updateLike(
  ctx: Context<{ place_id: string }, "request" | "body" | "params">
) {
  const params = await validateGetPlaceParams(ctx.params)
  const body = await validateGetPlaceBody(ctx.body)
  const userAuth = await withAuth(ctx)

  const place = await PlaceModel.findByIdWithAggregates(params.place_id, {
    user: userAuth.address,
  })

  if (!place) {
    throw new ErrorResponse(
      Response.NotFound,
      `Not found place "${params.place_id}"`
    )
  }

  const placeUserData = {
    place_id: params.place_id,
    user: userAuth.address,
  }

  const userLike = await UserLikesModel.findOne<UserLikeAttributes>(
    placeUserData
  )

  if (userLike && userLike.like === body.like) {
    return new ApiResponse({
      likes: place!.likes,
      dislikes: place!.dislikes,
      user_like: place.user_like,
      user_dislike: place.user_dislike,
    })
  }

  if (body.like === null) {
    await UserLikesModel.delete(placeUserData)
  } else {
    // TODO (bug): if the snapshot fetching fails, the like is stored as if the user doesn't have enough VP.
    // this should be retried or turned into a SQL tx to be able to rollback  if this fails
    const user_activity = await fetchScore(userAuth.address)
    await UserLikesModel.like(placeUserData, { like: body.like, user_activity })
  }

  await PlaceModel.updateLikes(params.place_id)

  const placeUpdated = await PlaceModel.findByIdWithAggregates(
    params.place_id,
    {
      user: userAuth.address,
    }
  )

  return new ApiResponse({
    likes: placeUpdated!.likes,
    dislikes: placeUpdated!.dislikes,
    user_like: placeUpdated!.user_like,
    user_dislike: placeUpdated!.user_dislike,
  })
}
