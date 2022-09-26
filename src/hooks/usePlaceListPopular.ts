import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"

import Places from "../api/Places"
import { AggregatePlaceAttributes } from "../entities/Place/types"

export function usePlaceListPopular(options?: {
  limit: number
  offset: number
}) {
  return useAsyncMemo(
    async () => {
      return Places.get().getPlacesPopular(options)
    },
    [options?.limit, options?.offset],
    { initialValue: [] as AggregatePlaceAttributes[] }
  )
}
