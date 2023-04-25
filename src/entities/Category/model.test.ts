import { categories } from "../../__data__/entities"
import CategoryModel from "./model"

const find = jest.spyOn(CategoryModel, "namedQuery")

describe("CategoryModel", () => {
  test("should find categories with places", async () => {
    find.mockResolvedValueOnce(Promise.resolve(categories))
    const categoriesFound = await CategoryModel.findCategoriesWithPlaces()
    expect(categoriesFound).toEqual(categories)
  })
})
