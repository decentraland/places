import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"

import Places from "../api/Places"
import { Categories } from "../components/Categories/types"

export default function usePlaceCategories(activeCategories?: string[]) {
  return useAsyncMemo(
    async () => {
      const categories = await Places.get().getCategories()
      return categories.map((c) => ({
        ...c,
        active: activeCategories ? activeCategories.includes(c.name) : false,
      })) as Categories
    },
    activeCategories ? [activeCategories] : [],
    { initialValue: [] as Categories }
  )
}
