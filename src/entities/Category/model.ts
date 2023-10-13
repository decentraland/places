import { Model } from "decentraland-gatsby/dist/entities/Database/model"
import { SQL, table } from "decentraland-gatsby/dist/entities/Database/utils"

import { CategoryAttributes } from "./types"

export default class CategoryModel extends Model<CategoryAttributes> {
  static tableName = "categories"
  static primaryKey = "name"

  static findCategoriesWithPlaces = async () => {
    const query = SQL`SELECT * FROM ${table(CategoryModel)} 
      WHERE places_counter != 0 
        AND active is true 
      ORDER BY name ASC`
    const categoriesFound = await CategoryModel.namedQuery<CategoryAttributes>(
      "find_categories_with_places",
      query
    )
    return categoriesFound
  }
}
