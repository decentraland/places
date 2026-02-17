import { withAuth } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import routes from "decentraland-gatsby/dist/entities/Route/wkc/routes"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"

import UserFavoriteModel from "./model"
import {
  updateUserFavoriteBodySchema,
  updateUserFavoriteParamsSchema,
} from "./schema"
import { UpdateUserFavoriteBody, UpdateUserFavoriteParams } from "./types"
import PlaceModel from "../Place/model"
import { findEntityByIdWithAggregates } from "../shared/entityInteractions"
import { isWorld } from "../shared/entityTypes"
import { fetchScore } from "../Snapshot/utils"
import WorldModel from "../World/model"

export default routes((router) => {
  router.patch("/places/:entity_id/favorites", updateFavorites)
})

export const validateGetPlaceParams =
  Router.validator<UpdateUserFavoriteParams>(updateUserFavoriteParamsSchema)

export const validateGetPlaceBody = Router.validator<UpdateUserFavoriteBody>(
  updateUserFavoriteBodySchema
)

// This endpoint is under /places/ but also handles world entities for
// retro-compatibility. The dedicated /worlds/:world_id/favorites endpoint
// exists for world favorites, but older clients may still send world IDs
// through this endpoint, so we look up both places and worlds here.
export async function updateFavorites(
  ctx: Context<{ entity_id: string }, "request" | "url" | "params" | "body">
) {
  const params = await validateGetPlaceParams(ctx.params)
  const body = await validateGetPlaceBody(ctx.body)
  const userAuth = await withAuth(ctx)

  const now = new Date()
  const entity = await findEntityByIdWithAggregates(params.entity_id, {
    user: userAuth.address,
  })

  if (!entity) {
    throw new ErrorResponse(
      Response.NotFound,
      `Not found entity "${params.entity_id}"`
    )
  }

  const user_activity = await fetchScore(userAuth.address)

  if (
    (body.favorites && entity.user_favorite) ||
    (!body.favorites && !entity.user_favorite)
  ) {
    return new ApiResponse({
      favorites: entity.favorites,
      user_favorite: entity.user_favorite,
    })
  }

  const entityUserData = {
    entity_id: params.entity_id,
    user: userAuth.address,
  }

  if (body.favorites) {
    const data = {
      ...entityUserData,
      user_activity,
      created_at: now,
    }
    await UserFavoriteModel.create(data)
  } else {
    await UserFavoriteModel.delete(entityUserData)
  }

  if (isWorld(entity)) {
    await WorldModel.updateFavorites(params.entity_id)
  } else {
    await PlaceModel.updateFavorites(params.entity_id)
  }

  return new ApiResponse({
    favorites: body.favorites ? entity.favorites + 1 : entity.favorites - 1,
    user_favorite: body.favorites,
  })
}
