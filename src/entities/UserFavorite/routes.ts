import { withAuth } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import routes from "decentraland-gatsby/dist/entities/Route/wkc/routes"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"

import UserFavoriteModel from "./model"
import {
  updateUserFavoriteBodySchema,
  updateUserFavoriteParamsSchema,
} from "./schema"
import { UpdateUserFavoriteBody, UpdateUserFavoriteParams } from "./types"
import PlaceModel from "../Place/model"
import { getPlace } from "../Place/routes/getPlace"
import { fetchScore } from "../Snapshot/utils"

export default routes((router) => {
  router.patch("/places/:place_id/favorites", updateFavorites)
})

export const validateGetPlaceParams =
  Router.validator<UpdateUserFavoriteParams>(updateUserFavoriteParamsSchema)

export const validateGetPlaceBody = Router.validator<UpdateUserFavoriteBody>(
  updateUserFavoriteBodySchema
)

async function updateFavorites(
  ctx: Context<{ place_id: string }, "request" | "url" | "params" | "body">
) {
  const params = await validateGetPlaceParams(ctx.params)
  const body = await validateGetPlaceBody(ctx.body)
  const userAuth = await withAuth(ctx)

  const now = new Date()
  const place = (await getPlace(ctx)).body.data
  const user_activity = await fetchScore(userAuth.address)

  if (
    (body.favorites && place.user_favorite) ||
    (!body.favorites && !place.user_favorite)
  ) {
    return new ApiResponse({
      favorites: place.favorites,
      user_favorite: place.user_favorite,
    })
  }

  const placeUserData = {
    place_id: params.place_id,
    user: userAuth.address,
  }

  if (body.favorites) {
    const data = {
      ...placeUserData,
      user_activity,
      created_at: now,
    }
    await UserFavoriteModel.create(data)
  } else {
    await UserFavoriteModel.delete(placeUserData)
  }

  await PlaceModel.updateFavorites(params.place_id)

  return new ApiResponse({
    favorites: body.favorites ? place.favorites + 1 : place.favorites - 1,
    user_favorite: body.favorites,
  })
}
