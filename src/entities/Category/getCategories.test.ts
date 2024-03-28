import { Request } from "decentraland-gatsby/dist/entities/Route/wkc/request/Request"

import CategoryModel from "./model"
import { getCategoryList } from "./routes"

const findCategoriesWithPlaces = jest.spyOn(
  CategoryModel,
  "findActiveCategoriesWithPlaces"
)

const findActiveCategories = jest.spyOn(CategoryModel, "findActiveCategories")

test("should return list of categories", async () => {
  findActiveCategories.mockResolvedValueOnce(Promise.resolve([]))
  findCategoriesWithPlaces.mockResolvedValueOnce(Promise.resolve([]))
  const request = new Request("/")
  const url = new URL("https://localhost/")
  const placeResponse = await getCategoryList({ request, url })
  expect(placeResponse.body).toEqual({
    ok: true,
    data: [],
  })
  expect(findCategoriesWithPlaces.mock.calls.length).toBe(1)
})
