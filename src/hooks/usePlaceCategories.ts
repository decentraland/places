import { useEffect, useState } from "react"

import useAsyncTask from "decentraland-gatsby/dist/hooks/useAsyncTask"

import Places from "../api/Places"

export default function usePlaceCategories(activeCategories?: string[]) {
  const [categories, setCategories] = useState<
    { name: string; count: number; active: boolean }[]
  >([])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, getCategories] = useAsyncTask(async () => {
    const categories = await Places.get().getCategories()
    setCategories([
      ...categories.map((c) => ({
        ...c,
        active: activeCategories ? activeCategories.includes(c.name) : false,
      })),
    ])
  }, [])

  useEffect(
    () => {
      getCategories()
    },
    activeCategories ? [activeCategories] : []
  )

  return categories
}
