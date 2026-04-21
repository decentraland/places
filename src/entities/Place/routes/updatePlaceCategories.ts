import withBearerToken from "decentraland-gatsby/dist/entities/Auth/routes/withBearerToken"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import { AjvObjectSchema } from "decentraland-gatsby/dist/entities/Schema/types"
import env from "decentraland-gatsby/dist/utils/env"

import PlaceCategories from "../../PlaceCategories/model"
import { createWkcValidator } from "../../shared/validate"
import PlaceModel from "../model"
import { getPlaceParamsSchema, updatePlaceCategoriesBodySchema } from "../schemas"
import {
  AggregatePlaceAttributes,
  GetPlaceParams,
  UpdatePlaceCategoriesBody,
} from "../types"

const validateUpdatePlaceCategoriesParams = createWkcValidator<GetPlaceParams>(
  getPlaceParamsSchema as AjvObjectSchema
)

const validateUpdatePlaceCategoriesBody =
  createWkcValidator<UpdatePlaceCategoriesBody>(
    updatePlaceCategoriesBodySchema as AjvObjectSchema
  )

export async function updatePlaceCategories(
  ctx: Context<{ place_id: string }, "request" | "body" | "params">
): Promise<ApiResponse<AggregatePlaceAttributes, {}>> {
  const token = env("PLACES_ADMIN_AUTH_TOKEN", "")
  await withBearerToken({ tokens: token ? [token] : [], optional: false })(ctx)

  const params = await validateUpdatePlaceCategoriesParams(ctx.params)
  const body = await validateUpdatePlaceCategoriesBody(ctx.body)

  const place = await PlaceModel.findByIdWithAggregates(params.place_id, {
    user: undefined,
  })

  if (!place) {
    throw new ErrorResponse(
      Response.NotFound,
      `Not found place "${params.place_id}"`
    )
  }

  const currentCategories = new Set(place.categories || [])

  for (const category of body.remove || []) {
    if (currentCategories.has(category)) {
      await PlaceCategories.removeCategoryFromPlace(params.place_id, category)
    }
  }

  for (const category of body.add || []) {
    if (!currentCategories.has(category)) {
      await PlaceCategories.addCategoryToPlace(params.place_id, category)
    }
  }

  const updatedPlace = await PlaceModel.findByIdWithAggregates(params.place_id, {
    user: undefined,
  })

  return new ApiResponse(updatedPlace!)
}
