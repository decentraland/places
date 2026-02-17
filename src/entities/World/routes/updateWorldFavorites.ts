import { withAuth } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"

import { isPlaceId } from "../../shared/entityInteractions"
import { fetchScore } from "../../Snapshot/utils"
import UserFavoriteModel from "../../UserFavorite/model"
import WorldModel from "../model"
import {
  updateWorldFavoriteBodySchema,
  updateWorldFavoriteParamsSchema,
} from "../schemas"

export type UpdateWorldFavoriteParams = {
  world_id: string
}

export type UpdateWorldFavoriteBody = {
  favorites: boolean
}

export const validateWorldFavoriteParams =
  Router.validator<UpdateWorldFavoriteParams>(updateWorldFavoriteParamsSchema)

export const validateWorldFavoriteBody =
  Router.validator<UpdateWorldFavoriteBody>(updateWorldFavoriteBodySchema)

export async function updateWorldFavorites(
  ctx: Context<{ world_id: string }, "request" | "url" | "params" | "body">
) {
  const params = await validateWorldFavoriteParams(ctx.params)
  const body = await validateWorldFavoriteBody(ctx.body)
  const userAuth = await withAuth(ctx)

  if (isPlaceId(params.world_id)) {
    throw new ErrorResponse(
      Response.BadRequest,
      `Invalid world ID "${params.world_id}". Use /places/:entity_id/favorites for place entities.`
    )
  }

  const now = new Date()
  const world = await WorldModel.findByIdWithAggregates(params.world_id, {
    user: userAuth.address,
  })

  if (!world) {
    throw new ErrorResponse(
      Response.NotFound,
      `Not found world "${params.world_id}"`
    )
  }

  const user_activity = await fetchScore(userAuth.address)

  if (
    (body.favorites && world.user_favorite) ||
    (!body.favorites && !world.user_favorite)
  ) {
    return new ApiResponse({
      favorites: world.favorites,
      user_favorite: world.user_favorite,
    })
  }

  const entityUserData = {
    entity_id: params.world_id,
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

  await WorldModel.updateFavorites(params.world_id)

  return new ApiResponse({
    favorites: body.favorites ? world.favorites + 1 : world.favorites - 1,
    user_favorite: body.favorites,
  })
}
