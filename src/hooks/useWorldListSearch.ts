import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"

import Places from "../api/Places"
import { AggregatePlaceAttributes } from "../entities/Place/types"

export function useWorldListSearch(
  options: {
    limit: number
    offset: number
  },
  search: string
) {
  return useAsyncMemo(
    async () => {
      if (search.length < 3) {
        return []
      }

      const result = await Places.get().getWorlds({
        ...options,
        search,
      })
      return result.data
    },
    [options, search],
    { initialValue: [] as AggregatePlaceAttributes[] }
  )
}
