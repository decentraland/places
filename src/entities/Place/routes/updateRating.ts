import isAdmin from "decentraland-gatsby/dist/entities/Auth/isAdmin"
import { withAuth } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import { createValidator } from "decentraland-gatsby/dist/entities/Route/validate"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import { AjvObjectSchema } from "decentraland-gatsby/dist/entities/Schema/types"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import { v4 as uuid } from "uuid"

import { isUpgradingRating } from "../../../utils/rating/contentRating"
import PlaceContentRatingModel from "../../PlaceContentRating/model"
import { notifyUpgradingRating } from "../../Slack/utils"
import PlaceModel from "../model"
import { getPlaceParamsSchema, updateRatingBodySchema } from "../schemas"
import {
  AggregatePlaceAttributes,
  GetPlaceParams,
  UpdateRatingBody,
} from "../types"

const validateUpdateRatingParams = createValidator<GetPlaceParams>(
  getPlaceParamsSchema as AjvObjectSchema
)

const validateUpdateRatingBody = createValidator<UpdateRatingBody>(
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

  try {
    Promise.all([
      PlaceModel.updatePlace(
        { ...place, content_rating: body.content_rating },
        ["content_rating"]
      ),
      PlaceContentRatingModel.create({
        id: uuid(),
        place_id: place.id,
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
      notifyUpgradingRating(place, "Content Moderator")
    }

    return new ApiResponse(
      await PlaceModel.findByIdWithAggregates(ctx.params.place_id, {
        user: userAuth.address,
      })
    )
  } catch (error: any) {
    throw new ErrorResponse(
      Response.InternalServerError,
      error.message || error
    )
  }
}
