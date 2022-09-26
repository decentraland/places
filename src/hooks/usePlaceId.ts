import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"
import isUUID from "validator/lib/isUUID"

import Places from "../api/Places"
import { AggregatePlaceAttributes } from "../entities/Place/types"

export function usePlaceId(placeId?: string | null) {
  return useAsyncMemo(
    async () => {
      if (!placeId || !isUUID(placeId)) {
        return {} as AggregatePlaceAttributes
      }

      return Places.get().getPlaceById(placeId)
    },
    [placeId],
    { callWithTruthyDeps: true, initialValue: {} as AggregatePlaceAttributes }
  )
}
