import { withAuth } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import routes from "decentraland-gatsby/dist/entities/Route/wkc/routes"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"

import PlaceModel from "../Place/model"
import { PlaceAttributes } from "../Place/types"
import UserFavoriteModel from "./model"
import {
  updateUserFavoriteBodySchema,
  updateUserFavoriteParamsSchema,
} from "./schema"
import {
  UpdateUserFavoriteBody,
  UpdateUserFavoriteParams,
  UserFavoriteAttributes,
} from "./types"

export default routes((router) => {
  router.patch("/places/:place_id/favorites", updateFavorites)
})

export const validateGetPlaceParams =
  Router.validator<UpdateUserFavoriteParams>(updateUserFavoriteParamsSchema)

export const validateGetPlaceBody = Router.validator<UpdateUserFavoriteBody>(
  updateUserFavoriteBodySchema
)

async function updateFavorites(ctx: Context<{ place_id: string }>) {
  const params = await validateGetPlaceParams(ctx.params)
  const body = await validateGetPlaceBody(ctx.body)
  const userAuth = await withAuth(ctx)

  const now = new Date()

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

  const userFavorite = await UserFavoriteModel.findOne<UserFavoriteAttributes>(
    placeUserData
  )

  if ((body.favorites && userFavorite) || (!body.favorites && !userFavorite)) {
    return new ApiResponse({ total: place.favorites })
  }

  if (body.favorites) {
    const data = {
      ...placeUserData,
      user_activity: 0,
      created_at: now,
    }
    await UserFavoriteModel.create(data)
  } else {
    await UserFavoriteModel.delete(placeUserData)
  }

  await PlaceModel.updateFavorites(params.place_id)

  const placeUpdated = await PlaceModel.findOne<PlaceAttributes>({
    id: params.place_id,
  })

  return new ApiResponse({ total: placeUpdated!.favorites })
}
