import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"

import PlacePositionModel from "../../PlacePosition/model"

export const getPlaceBasePositionList = Router.memo(async () => {
  const [data, total] = await Promise.all([
    PlacePositionModel.findAll(),
    PlacePositionModel.count(),
  ])

  return new ApiResponse(data, { total })
})
