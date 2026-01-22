import CategoryModel from "./model"
import { categoriesWithPlacesCount } from "../../__data__/categories"

const find = jest.spyOn(CategoryModel, "namedQuery")

beforeEach(() => {
  find.mockReset()
})

describe("CategoryModel", () => {
  test("should find active categories", async () => {
    find.mockResolvedValueOnce(Promise.resolve(categoriesWithPlacesCount))
    const categoriesFound = await CategoryModel.findActiveCategories()
    expect(categoriesFound).toEqual(categoriesWithPlacesCount)

    const [name, sql] = find.mock.calls[0]
    expect(name).toBe("find_active_categories")
    expect(sql.values).toEqual([])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT c.name FROM "categories" c WHERE c.active IS true
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })

  test("should find categories with places", async () => {
    find.mockResolvedValueOnce(Promise.resolve(categoriesWithPlacesCount))
    const categoriesFound = await CategoryModel.findActiveCategoriesWithPlaces()
    expect(categoriesFound).toEqual(
      categoriesWithPlacesCount.map((c) => ({ ...c, count: Number(c.count) }))
    )

    const [name, sql] = find.mock.calls[0]
    expect(name).toBe("find_active_categories_with_places_count")
    expect(sql.values).toEqual([])
    expect(sql.text.trim().replace(/\s{2,}/gi, " ")).toEqual(
      `
        SELECT c.name, count(pc.place_id) as count 
        FROM "categories" c 
        LEFT JOIN "place_categories" pc ON pc.category_id = c.name
        LEFT JOIN "places" p ON pc.place_id = p.id 
        WHERE c.active IS true 
        GROUP BY c.name ORDER BY count DESC
      `
        .trim()
        .replace(/\s{2,}/gi, " ")
    )
  })
})
