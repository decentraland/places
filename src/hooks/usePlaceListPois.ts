import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"
import shuffle from "lodash/shuffle"

import Places from "../api/Places"
import { AggregatePlaceAttributes } from "../entities/Place/types"
import { getPois } from "../modules/pois"

export function usePlaceListPois(options: { limit: number; offset: number }) {
  return useAsyncMemo(
    async () => {
      const pois = await getPois()
      if (!pois || pois.length === 0) {
        return []
      }

      const result = await Places.get().getPlaces({
        ...options,
        positions: pois,
      })
      return shuffle(result.data).filter(
        (place) => !place.image?.startsWith("https://api.decentraland.org")
      )
    },
    [options],
    { initialValue: [] as AggregatePlaceAttributes[] }
  )
}
