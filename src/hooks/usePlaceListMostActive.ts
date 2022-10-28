import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"

import Places from "../api/Places"
import { AggregatePlaceAttributes } from "../entities/Place/types"

export function usePlaceListMostActive(options?: {
  limit: number
  offset: number
}) {
  return useAsyncMemo(
    async () => {
      const result = await Places.get().getPlacesMostActive(options)
      return result.data
    },
    [options?.limit, options?.offset],
    { initialValue: [] as AggregatePlaceAttributes[] }
  )
}
