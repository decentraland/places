import { Model } from "decentraland-gatsby/dist/entities/Database/model"
import { SQL, table } from "decentraland-gatsby/dist/entities/Database/utils"

import PlaceCategories from "../PlaceCategories/model"
import { CategoryAttributes, CategoryWithPlaceCount } from "./types"

export default class CategoryModel extends Model<CategoryAttributes> {
  static tableName = "categories"
  static primaryKey = "name"

  static findActiveCategories = async () => {
    const query = SQL`
      SELECT c.name FROM ${table(CategoryModel)} WHERE c.active IS true
    `

    return await CategoryModel.namedQuery<{ name: string }>(
      "find_active_categories",
      query
    )
  }

  static findCategoriesWithPlaces = async () => {
    const query = SQL`
      SELECT c.name, count(pc.place_id) FROM ${table(CategoryModel)} c
      LEFT JOIN ${table(PlaceCategories)} pc ON pc.category_id = c.name
      WHERE c.active IS true  
      GROUP BY c.name`

    return await CategoryModel.namedQuery<CategoryWithPlaceCount>(
      "find_categories_with_places_count",
      query
    )
  }
}
