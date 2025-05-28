import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"
import { numeric } from "decentraland-gatsby/dist/entities/Schema/utils"

import PlacePositionModel from "../../PlacePosition/model"
import { getPlaceListQuerySchema } from "../schemas"
import { FindWithAggregatesOptions, GetPlaceListQuery } from "../types"

const validateGetPlaceBasePositionListQuery = Router.validator<
  Pick<GetPlaceListQuery, "limit" | "offset">
>(getPlaceListQuerySchema)

export const getPlaceBasePositionList = Router.memo(
  async (ctx: Context<{}, "url" | "request">) => {
    const query = await validateGetPlaceBasePositionListQuery({
      offset: ctx.url.searchParams.get("offset"),
      limit: ctx.url.searchParams.get("limit"),
    })

    const options: Pick<FindWithAggregatesOptions, "limit" | "offset"> = {
      offset: numeric(query.offset, { min: 0 }) ?? 0,
      limit: numeric(query.limit, { min: 0, max: 500 }) ?? 500,
    }

    const [data, total] = await Promise.all([
      PlacePositionModel.findWithAggregates(options),
      PlacePositionModel.count(),
    ])

    return new ApiResponse(data, { total })
  }
)
