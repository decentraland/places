import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"

import Places from "../api/Places"
import { AggregatePlaceAttributes } from "../entities/Place/types"
import { getPois } from "../modules/pois"

export function usePlaceListPois(options?: { limit: number; offset: number }) {
  return useAsyncMemo(
    async () => {
      const pois = await getPois()
      if (!pois || pois.length === 0) {
        return []
      }

      return Places.get().getPlacesPois(pois, options)
    },
    [options?.limit, options?.offset],
    { initialValue: [] as AggregatePlaceAttributes[] }
  )
}
