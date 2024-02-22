import { useCallback, useEffect, useMemo, useState } from "react"

import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"

import Places from "../api/Places"
import {
  Category,
  CategoryCountTargetOptions,
} from "../entities/Category/types"

export default function usePlaceCategoriesManager(
  target: CategoryCountTargetOptions,
  initActiveCategories?: string[]
) {
  const [originalCategories] = useAsyncMemo(
    async () => {
      const categories = await Places.get().getCategories(target)
      return categories.map((category) => ({
        ...category,
        active: initActiveCategories?.includes(category.name) || false,
      })) as Category[]
    },
    [initActiveCategories],
    { initialValue: [] as Category[] }
  )

  const [categories, setCategories] = useState([] as Category[])

  const [categoriesStack, setCateoriesStack] = useState([] as Category[])

  useEffect(() => {
    if (originalCategories.length > 0) {
      setCategories(originalCategories)
    }

    // when loads with params
    if (!categoriesStack.length) {
      setCateoriesStack(originalCategories.filter(({ active }) => active))
    } else {
      if (!initActiveCategories?.length) {
        setCateoriesStack([])
      }
    }
  }, [originalCategories])

  const previousActiveCategories = useMemo(
    () => categories.filter(({ active }) => active),
    [initActiveCategories]
  )

  const handleAddCategory = useCallback(
    (categoryToActive: string) => {
      const newCategories = categories.map((category) => ({
        ...category,
        active: categoryToActive === category.name || category.active,
      }))
      setCategories(newCategories)
      setCateoriesStack((currentStack) => [
        newCategories.find(({ name }) => name == categoryToActive)!,
        ...currentStack,
      ])
    },
    [setCateoriesStack, categories]
  )

  const handleRemoveCategory = useCallback(
    (categoryToRemove: string) => {
      setCategories((prevCategories) =>
        prevCategories.map((category) => ({
          ...category,
          active: categoryToRemove === category.name ? false : category.active,
        }))
      )
      setCateoriesStack((categoriesStack) =>
        categoriesStack.filter(({ name }) => name != categoryToRemove)
      )
    },
    [setCategories, setCateoriesStack]
  )

  const handleSyncCategory = useCallback(
    (newCategoriesState: Category[]) => {
      setCategories(newCategoriesState)
      setCateoriesStack(newCategoriesState.filter(({ active }) => active))
    },
    [setCategories]
  )

  const isFilteringByCategory =
    categories.filter(({ active }) => active).length > 0

  return {
    categories,
    previousActiveCategories,
    categoriesStack,
    isFilteringByCategory,
    handleAddCategory,
    handleRemoveCategory,
    handleSyncCategory,
  } as const
}
