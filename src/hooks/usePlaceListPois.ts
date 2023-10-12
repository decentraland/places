import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"
import shuffle from "lodash/shuffle"

import Places from "../api/Places"
import { DecentralandCategories } from "../entities/Category/types"
import { AggregatePlaceAttributes } from "../entities/Place/types"

export function usePlaceListPois(options: { limit: number; offset: number }) {
  return useAsyncMemo(
    async () => {
      const result = await Places.get().getPlaces({
        ...options,
        categories: [DecentralandCategories.POI],
      })
      return shuffle(result.data).filter(
        (place) => !place.image?.startsWith("https://api.decentraland.org")
      )
    },
    [options],
    { initialValue: [] as AggregatePlaceAttributes[] }
  )
}
