import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import routes from "decentraland-gatsby/dist/entities/Route/wkc/routes"

import CategoryModel from "./model"

export default routes((router) => {
  router.get("/categories", getCategoryList)
})

export async function getCategoryList() {
  const categories = await CategoryModel.findCategoriesWithPlaces()

  return new ApiResponse(
    categories.map((category) => ({
      ...category,
      count: Number(category.count),
    }))
  )
}
