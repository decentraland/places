import { withAuth } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import routes from "decentraland-gatsby/dist/entities/Route/wkc/routes"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"

import PlaceModel from "../Place/model"
import { PlaceAttributes } from "../Place/types"
import UserLikesModel from "../UserLikes/model"
import { updateUserLikeBodySchema, updateUserLikeParamsSchema } from "./schema"
import {
  UpdateUserLikeBody,
  UpdateUserLikeParams,
  UserLikeAttributes,
} from "./types"

export default routes((router) => {
  router.patch("/places/:place_id/likes", updateLike)
  router.delete("/places/:place_id/likes", deleteLike)
})

export const validateGetPlaceParams = Router.validator<UpdateUserLikeParams>(
  updateUserLikeParamsSchema
)

export const validateGetPlaceBody = Router.validator<UpdateUserLikeBody>(
  updateUserLikeBodySchema
)

async function updateLike(ctx: Context<{ place_id: string }>) {
  const params = await validateGetPlaceParams(ctx.params)
  const body = await validateGetPlaceBody(ctx.body)
  const userAuth = await withAuth(ctx)

  const place = await PlaceModel.findOne<PlaceAttributes>({
    id: params.place_id,
  })

  if (!place) {
    throw new ErrorResponse(
      Response.NotFound,
      `Not found place "${params.place_id}"`
    )
  }

  const placeUserData = {
    place_id: params.place_id,
    user: userAuth.auth,
  }

  const userLike = await UserLikesModel.findOne<UserLikeAttributes>(
    placeUserData
  )

  if (userLike && userLike.like === body.like) {
    return new ApiResponse({
      likes: place!.likes,
      dislikes: place!.dislikes,
    })
  }

  await UserLikesModel.like(placeUserData, { like: body.like })

  await PlaceModel.updateLikes(params.place_id)

  const placeUpdated = await PlaceModel.findOne<PlaceAttributes>({
    id: params.place_id,
  })

  return new ApiResponse({
    likes: placeUpdated!.likes,
    dislikes: placeUpdated!.dislikes,
  })
}

async function deleteLike(ctx: Context<{ place_id: string }>) {
  const params = await validateGetPlaceParams(ctx.params)
  const userAuth = await withAuth(ctx)

  const place = await PlaceModel.findOne<PlaceAttributes>({
    id: params.place_id,
  })

  if (!place) {
    throw new ErrorResponse(
      Response.NotFound,
      `Not found place "${params.place_id}"`
    )
  }

  const placeUserData = {
    place_id: params.place_id,
    user: userAuth.auth,
  }

  const userLike = await UserLikesModel.findOne<UserLikeAttributes>(
    placeUserData
  )

  if (!userLike) {
    throw new ErrorResponse(
      Response.NotFound,
      `Not found like or dislike for user`
    )
  }

  const deleteResponse = await UserLikesModel.delete(placeUserData)

  if (deleteResponse.rowCount < 1) {
    return new ApiResponse(false)
  }
  return new ApiResponse(true)
}