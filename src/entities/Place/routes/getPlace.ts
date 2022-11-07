import { withAuthOptional } from "decentraland-gatsby/dist/entities/Auth/routes/withDecentralandAuth"
import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import ErrorResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ErrorResponse"
import Response from "decentraland-gatsby/dist/entities/Route/wkc/response/Response"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"

import { getHotScenes } from "../../../modules/hotScenes"
import { getSceneStats } from "../../../modules/sceneStats"
import PlaceModel from "../model"
import { getPlaceParamsSchema } from "../schemas"
import { AggregatePlaceAttributes, GetPlaceParams } from "../types"
import { placesWithUserCount, placesWithUserVisits } from "../utils"

export const validateGetPlaceParams =
  Router.validator<GetPlaceParams>(getPlaceParamsSchema)

export const getPlace = Router.memo(
  async (
    ctx: Context<{ place_id: string }, "params" | "request">
  ): Promise<ApiResponse<AggregatePlaceAttributes, {}>> => {
    const params = await validateGetPlaceParams(ctx.params)
    const userAuth = await withAuthOptional(ctx)

    const place = await PlaceModel.findByIdWithAggregates(params.place_id, {
      user: userAuth?.address,
    })

    if (!place) {
      throw new ErrorResponse(
        Response.NotFound,
        `Not found place "${params.place_id}"`
      )
    }
    const hotScenes = await getHotScenes()
    const sceneStats = await getSceneStats()
    let aggregatedPlaces = [place]
    aggregatedPlaces = placesWithUserCount(aggregatedPlaces, hotScenes)
    aggregatedPlaces = placesWithUserVisits(aggregatedPlaces, sceneStats)

    return new ApiResponse(aggregatedPlaces[0])
  }
)
