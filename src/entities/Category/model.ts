import { Model } from "decentraland-gatsby/dist/entities/Database/model"
import { SQL, table } from "decentraland-gatsby/dist/entities/Database/utils"

import PlaceCategories from "../PlaceCategories/model"
import { CategoryAttributes, CategoryWithPlaceCount } from "./types"

export default class CategoryModel extends Model<CategoryAttributes> {
  static tableName = "categories"
  static primaryKey = "name"

  static findCategoriesWithPlaces = async () => {
    const query = SQL`
      SELECT c.name, count(pc.place_id) FROM ${table(CategoryModel)} c
      INNER JOIN ${table(PlaceCategories)} ON pc pc.category_id = c.name
      WHERE c.active IS true  
      GROUP BY pc.category_id
      ORDER BY c.name ASC`

    const categoriesFound =
      await CategoryModel.namedQuery<CategoryWithPlaceCount>(
        "find_categories_with_places_count",
        query
      )

    return categoriesFound
  }
}
