import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"
import shuffle from "lodash/shuffle"

import Places from "../api/Places"
import { AggregatePlaceAttributes } from "../entities/Place/types"

export function usePlaceListPois(options: { limit: number; offset: number }) {
  return useAsyncMemo(
    async () => {
      const result = await Places.get().getPlaces({
        ...options,
        category_ids: ["poi"],
      })
      return shuffle(result.data).filter(
        (place) => !place.image?.startsWith("https://api.decentraland.org")
      )
    },
    [options],
    { initialValue: [] as AggregatePlaceAttributes[] }
  )
}
