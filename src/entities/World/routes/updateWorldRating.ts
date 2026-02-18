import { randomUUID } from "crypto"

import isAdmin from "decentraland-gatsby/dist/entities/Auth/isAdmin"
import { withAuth } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import { AjvObjectSchema } from "decentraland-gatsby/dist/entities/Schema/types"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import { isUpgradingRating } from "../../../utils/rating/contentRating"
import PlaceContentRatingModel from "../../PlaceContentRating/model"
import { notifyUpgradingRating } from "../../Slack/utils"
import { createWkcValidator } from "../../shared/validate"
import WorldModel from "../model"
import {
  updateWorldRatingBodySchema,
  updateWorldRatingParamsSchema,
} from "../schemas"
import { AggregateWorldAttributes } from "../types"

export type UpdateWorldRatingParams = {
  world_id: string
}

export type UpdateWorldRatingBody = {
  content_rating: SceneContentRating
  comment?: string
}

const validateUpdateRatingParams = createWkcValidator<UpdateWorldRatingParams>(
  updateWorldRatingParamsSchema as AjvObjectSchema
)

const validateUpdateRatingBody = createWkcValidator<UpdateWorldRatingBody>(
  updateWorldRatingBodySchema as AjvObjectSchema
)

export async function updateWorldRating(
  ctx: Context<{ world_id: string }, "request" | "body" | "params">
): Promise<ApiResponse<AggregateWorldAttributes, {}>> {
  const userAuth = await withAuth(ctx)
  const params = await validateUpdateRatingParams(ctx.params)
  const body = await validateUpdateRatingBody(ctx.body)

  if (!isAdmin(userAuth.address)) {
    throw new ErrorResponse(
      Response.Forbidden,
      `Only admin allowed to update rating`
    )
  }

  const world = await WorldModel.findByIdWithAggregates(ctx.params.world_id, {
    user: userAuth.address,
  })

  if (!world) {
    throw new ErrorResponse(
      Response.NotFound,
      `Not found world "${params.world_id}"`
    )
  }

  const newWorld = { ...world, content_rating: body.content_rating }
  await Promise.all([
    WorldModel.upsertWorld({
      world_name: world.world_name!,
      content_rating: body.content_rating,
    }),
    PlaceContentRatingModel.create({
      id: randomUUID(),
      entity_id: world.id,
      original_rating: world.content_rating,
      update_rating: body.content_rating,
      moderator: userAuth.address,
      comment: body.comment || null,
      created_at: new Date(),
    }),
  ])

  if (
    world.content_rating &&
    isUpgradingRating(body.content_rating, world.content_rating)
  ) {
    notifyUpgradingRating(world, "Content Moderator", body.content_rating)
  }

  return new ApiResponse(newWorld as AggregateWorldAttributes)
}
