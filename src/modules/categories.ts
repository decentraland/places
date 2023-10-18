import { Category } from "../entities/Category/types"

export const getCurrentCategories = (
  categories: Category[],
  action: "add" | "remove",
  categoryId: string
) => {
  let currentCategories = categories.filter(({ active }) => active)
  if (action === "add") {
    if (!currentCategories.find(({ name }) => name === categoryId)) {
      const category = {
        ...categories.find(({ name }) => name === categoryId)!,
      }
      category.active = true
      currentCategories.push(category)
    }
  }

  if (action === "remove") {
    currentCategories = currentCategories.filter(
      ({ name }) => name !== categoryId
    )
  }

  return currentCategories
}
