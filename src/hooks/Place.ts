import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"
import isUUID from "validator/lib/isUUID"

import Places from "../api/Places"

export function usePlaceId(placeId?: string | null) {
  return useAsyncMemo(
    async () => {
      if (!placeId || !isUUID(placeId)) {
        return null
      }

      return Places.get().getPlaceById(placeId)
    },
    [placeId],
    { callWithTruthyDeps: true }
  )
}
