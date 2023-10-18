import CategoryModel from "./model"
import { getCategoryList } from "./routes"

const findCategoriesWithPlaces = jest.spyOn(
  CategoryModel,
  "findActiveCategoriesWithPlaces"
)

test("should return list of categories", async () => {
  findCategoriesWithPlaces.mockResolvedValueOnce(Promise.resolve([]))
  const placeResponse = await getCategoryList()
  expect(placeResponse.body).toEqual({
    ok: true,
    data: [],
  })
  expect(findCategoriesWithPlaces.mock.calls.length).toBe(1)
})
