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
import { createWkcValidator } from "../../shared/validate"
import { notifyUpgradingRating } from "../../Slack/utils"
import PlaceModel from "../model"
import { getPlaceParamsSchema, updateRatingBodySchema } from "../schemas"
import {
  AggregatePlaceAttributes,
  GetPlaceParams,
  UpdateRatingBody,
} from "../types"

const validateUpdateRatingParams = createWkcValidator<GetPlaceParams>(
  getPlaceParamsSchema as AjvObjectSchema
)

const validateUpdateRatingBody = createWkcValidator<UpdateRatingBody>(
  updateRatingBodySchema as AjvObjectSchema
)

export async function updateRating(
  ctx: Context<{ place_id: string }, "request" | "body" | "params">
): Promise<ApiResponse<AggregatePlaceAttributes, {}>> {
  const userAuth = await withAuth(ctx)
  const params = await validateUpdateRatingParams(ctx.params)
  const body = await validateUpdateRatingBody(ctx.body)

  if (!isAdmin(userAuth.address)) {
    throw new ErrorResponse(
      Response.Forbidden,
      `Only admin allowed to update rating`
    )
  }

  const place = await PlaceModel.findByIdWithAggregates(ctx.params.place_id, {
    user: userAuth.address,
  })

  if (!place) {
    throw new ErrorResponse(
      Response.NotFound,
      `Not found place "${params.place_id}"`
    )
  }

  const newPlace = { ...place, content_rating: body.content_rating }
  Promise.all([
    PlaceModel.updatePlace(newPlace, ["content_rating"]),
    PlaceContentRatingModel.create({
      id: randomUUID(),
      entity_id: place.id,
      original_rating: place.content_rating,
      update_rating: body.content_rating,
      moderator: userAuth.address,
      comment: body.comment || null,
      created_at: new Date(),
    }),
  ])

  if (
    place.content_rating &&
    isUpgradingRating(
      body.content_rating,
      place.content_rating as SceneContentRating
    )
  ) {
    notifyUpgradingRating(place, "Content Moderator", body.content_rating)
  }

  return new ApiResponse(newPlace)
}
