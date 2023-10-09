import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import routes from "decentraland-gatsby/dist/entities/Route/wkc/routes"

import { categories as CategoryTranslations } from "../../intl/en.json"
import CategoryModel from "./model"

export default routes((router) => {
  router.get("/categories", getCategoryList)
})

export async function getCategoryList() {
  const categories = await CategoryModel.findActiveCategoriesWithPlaces()

  const withTranslations = categories.map((category) => ({
    ...category,
    i18n: {
      en: CategoryTranslations[
        category.name as keyof typeof CategoryTranslations
      ],
    },
  }))

  return new ApiResponse(withTranslations)
}
