import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import Router from "decentraland-gatsby/dist/entities/Route/wkc/routes/Router"

import PlaceModel from "../../Place/model"

export const getWorldNamesList = Router.memo(async (_) => {
  const [data, total] = await Promise.all([
    PlaceModel.findWorldNames(),
    PlaceModel.countWorldNames(),
  ])
  const worldNames = data.map((world) => world.world_name)
  return new ApiResponse(worldNames, {
    total,
  })
})
