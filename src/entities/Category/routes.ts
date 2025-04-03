import Context from "decentraland-gatsby/dist/entities/Route/wkc/context/Context"
import ApiResponse from "decentraland-gatsby/dist/entities/Route/wkc/response/ApiResponse"
import routes from "decentraland-gatsby/dist/entities/Route/wkc/routes"

import CategoryModel from "./model"
import { CategoryCountTargetOptions } from "./types"
import { categories as CategoryTranslations } from "../../intl/en.json"

export default routes((router) => {
  router.get("/categories", getCategoryList)
})

export async function getCategoryList(ctx: Context<{}, "url" | "request">) {
  let target = CategoryCountTargetOptions.ALL
  switch (ctx.url.searchParams.get("target")) {
    case CategoryCountTargetOptions.PLACES:
    case CategoryCountTargetOptions.WORLDS:
      target = ctx.url.searchParams.get("target")! as CategoryCountTargetOptions
      break
    default:
      break
  }

  const allActiveCategories = await CategoryModel.findActiveCategories()

  const categoriesWithCount =
    await CategoryModel.findActiveCategoriesWithPlaces(target)

  const withTranslations = allActiveCategories.map((category) => ({
    ...category,
    count:
      categoriesWithCount.find((c) => c.name === category.name)?.count || 0,
    i18n: {
      en: CategoryTranslations[
        category.name as keyof typeof CategoryTranslations
      ],
    },
  }))

  return new ApiResponse(withTranslations)
}
