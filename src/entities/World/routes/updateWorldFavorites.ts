import { withAuth } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"

import { findEntityByIdWithAggregates } from "../../shared/entityInteractions"
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

  const now = new Date()
  const entity = await findEntityByIdWithAggregates(params.world_id, {
    user: userAuth.address,
  })

  if (!entity) {
    throw new ErrorResponse(
      Response.NotFound,
      `Not found entity "${params.world_id}"`
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
    favorites: body.favorites ? entity.favorites + 1 : entity.favorites - 1,
    user_favorite: body.favorites,
  })
}
