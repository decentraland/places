import { Model } from "decentraland-gatsby/dist/entities/Database/model"
import {
  SQL,
  join,
  table,
  values,
} from "decentraland-gatsby/dist/entities/Database/utils"

import { PlaceCategoriesAttributes } from "./types"

export default class PlaceCategories extends Model<PlaceCategoriesAttributes> {
  static tableName: string = "place_categories"

  static async getCountPerCategory() {
    const query = SQL`SELECT category_id, COUNT(place_id) as count FROM ${table(
      PlaceCategories
    )} GROUP BY category_id`

    const result = await PlaceCategories.namedQuery<{
      category_id: string
      count: number
    }>("get_count_per_category", query)

    return result
  }

  static async removeCategoryFromPlace(placeId: string, category: string) {
    const query = SQL`DELETE FROM ${table(
      PlaceCategories
    )} WHERE place_id = ${placeId} AND category_id = ${category}`

    await PlaceCategories.namedQuery("remove_place_category", query)
  }

  static async addCategoryToPlace(placeId: string, category: string) {
    const query = SQL`INSERT INTO ${table(
      PlaceCategories
    )} (place_id, category_id) VALUES (${placeId}, ${category})`

    await PlaceCategories.namedQuery("add_category_to_place", query)
  }

  static async addCategoriesToPlaces(bulk: string[][]) {
    const mappedValues = bulk.map((val) => values(val))

    const valuesInBulk = join(mappedValues)

    const query = SQL`INSERT INTO ${table(
      PlaceCategories
    )} (place_id, category_id) VALUES ${valuesInBulk}`

    await PlaceCategories.namedQuery("add_categories_to_places", query)
  }

  static async cleanPlaceCategories(placeId: string) {
    const query = SQL`DELETE FROM ${table(
      PlaceCategories
    )} WHERE place_id = ${placeId}`

    await PlaceCategories.namedQuery("clean_place_categories", query)
  }

  static async findCategoriesByPlaceId(placeId: string) {
    const query = SQL`SELECT category_id FROM ${table(
      PlaceCategories
    )} WHERE place_id = ${placeId}`

    return await PlaceCategories.namedQuery<{ category_id: string }>(
      "find_categories_by_place_id",
      query
    )
  }
}
