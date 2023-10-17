import { useCallback, useEffect, useMemo, useState } from "react"

import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"

import Places from "../api/Places"
import { Category } from "../entities/Category/types"

export default function usePlaceCategoriesManager(
  initActiveCategories?: string[]
) {
  const [originalCategories] = useAsyncMemo(
    async () => {
      const categories = await Places.get().getCategories()
      return categories.map((category) => ({
        ...category,
        active: initActiveCategories?.includes(category.name) || false,
      })) as Category[]
    },
    [initActiveCategories],
    { initialValue: [] as Category[] }
  )

  const [categories, setCategories] = useState([] as Category[])

  useEffect(() => {
    originalCategories.length > 0 && setCategories(originalCategories)
  }, [originalCategories])

  const previousActiveCategories = useMemo(
    () => categories.filter(({ active }) => active),
    [initActiveCategories]
  )

  const handleAddCategory = useCallback(
    (categoryToActive: string) => {
      setCategories((prevCategories) =>
        prevCategories.map((category) => ({
          ...category,
          active: categoryToActive === category.name || category.active,
        }))
      )
    },
    [setCategories]
  )

  const handleRemoveCategory = useCallback(
    (categoryToRemove: string) => {
      setCategories((prevCategories) =>
        prevCategories.map((category) => ({
          ...category,
          active: categoryToRemove === category.name ? false : category.active,
        }))
      )
    },
    [setCategories]
  )

  const handleSyncCategory = useCallback(
    (newCategoriesState: Category[]) => setCategories(newCategoriesState),
    [setCategories]
  )

  return [
    categories,
    previousActiveCategories,
    {
      handleAddCategory,
      handleRemoveCategory,
      handleSyncCategory,
    },
  ] as const
}
