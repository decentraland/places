import { categoriesWithPlacesCount } from "../../__data__/categories"
import CategoryModel from "./model"

const find = jest.spyOn(CategoryModel, "namedQuery")

describe("CategoryModel", () => {
  test("should find categories with places", async () => {
    find.mockResolvedValueOnce(Promise.resolve(categoriesWithPlacesCount))
    const categoriesFound = await CategoryModel.findActiveCategoriesWithPlaces()
    expect(categoriesFound).toEqual(
      categoriesWithPlacesCount.map((c) => ({ ...c, count: Number(c.count) }))
    )
  })
})
