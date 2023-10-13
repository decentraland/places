import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"

import Places from "../api/Places"
import { Category } from "../entities/Category/types"

/** @deprecated use isePlaceCategories instead */
export default function usePlaceCategories(activeCategories?: string[]) {
  return useAsyncMemo(
    async () => {
      const categories = await Places.get().getCategories()
      return categories.map((category) => ({
        ...category,
        active: activeCategories
          ? activeCategories.includes(category.name)
          : false,
      })) as Category[]
    },
    activeCategories ? [activeCategories] : [],
    { initialValue: [] as Category[] }
  )
}
