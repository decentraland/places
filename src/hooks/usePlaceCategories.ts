import { useEffect, useState } from "react"

import useAsyncTask from "decentraland-gatsby/dist/hooks/useAsyncTask"

import Places from "../api/Places"

export default function usePlaceCategories() {
  const [categories, setCategories] = useState<
    { name: string; count: number }[]
  >([])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, getCategories] = useAsyncTask(async () => {
    const categories = await Places.get().getCategories()
    setCategories([...categories])
  }, [])

  useEffect(() => {
    getCategories()
  }, [])

  return categories
}
