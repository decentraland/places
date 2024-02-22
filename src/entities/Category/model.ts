import { Model } from "decentraland-gatsby/dist/entities/Database/model"
import {
  SQL,
  conditional,
  table,
} from "decentraland-gatsby/dist/entities/Database/utils"

import PlaceModel from "../Place/model"
import PlaceCategories from "../PlaceCategories/model"
import {
  CategoryAttributes,
  CategoryCountTargetOptions,
  CategoryWithPlaceCount,
} from "./types"

export default class CategoryModel extends Model<CategoryAttributes> {
  static tableName = "categories"
  static primaryKey = "name"

  static findActiveCategories = async () => {
    const query = SQL`
      SELECT c.name FROM ${table(CategoryModel)} c  WHERE c.active IS true
    `

    return await CategoryModel.namedQuery<{ name: string }>(
      "find_active_categories",
      query
    )
  }

  static async findActiveCategoriesWithPlaces(
    target: CategoryCountTargetOptions = CategoryCountTargetOptions.ALL
  ): Promise<CategoryWithPlaceCount[]> {
    const query = SQL`
      SELECT c.name, count(pc.place_id) as count FROM ${table(CategoryModel)} c
      LEFT JOIN ${table(PlaceCategories)} pc ON pc.category_id = c.name
      LEFT JOIN ${table(PlaceModel)} p ON pc.place_id = p.id
      WHERE c.active IS true

      ${conditional(
        target === CategoryCountTargetOptions.WORLDS,
        SQL`AND p.world IS true`
      )}
      ${conditional(
        target === CategoryCountTargetOptions.PLACES,
        SQL`AND p.world IS false`
      )}

      GROUP BY c.name
      ORDER BY count DESC
      `

    const categories = await CategoryModel.namedQuery<{
      name: string
      count: string
    }>("find_active_categories_with_places_count", query)

    return categories.map((category) => ({
      ...category,
      count: Number(category.count),
    }))
  }
}
