import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"
import shuffle from "lodash/shuffle"

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

      const positions = shuffle(pois).slice(0, 5)
      const result = await Places.get().getPlaces({ positions })
      return result.data
    },
    [options?.limit, options?.offset],
    { initialValue: [] as AggregatePlaceAttributes[] }
  )
}
