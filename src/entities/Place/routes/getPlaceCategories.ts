import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"

import PlaceCategories from "../../PlaceCategories/model"
import { getPlaceParamsSchema } from "../schemas"
import { GetPlaceParams } from "../types"

export const validateGetPlaceParams =
  Router.validator<GetPlaceParams>(getPlaceParamsSchema)

export const getPlaceCategories = Router.memo(
  async (
    ctx: Context<{ place_id: string }, "params" | "url" | "request">
  ): Promise<ApiResponse<{ categories: string[] }, {}>> => {
    const params = await validateGetPlaceParams(ctx.params)

    const placeCategories = await PlaceCategories.findCategoriesByPlaceId(
      params.place_id
    )

    return new ApiResponse({
      categories: placeCategories.map(({ category_id }) => category_id),
    })
  }
)
