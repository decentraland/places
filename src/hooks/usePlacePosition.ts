import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"

import Places from "../api/Places"
import { AggregatePlaceAttributes } from "../entities/Place/types"
import validPosition from "../utils/position/validPosition"

export function usePlacePosition(position?: string | null) {
  return useAsyncMemo(
    async () => {
      const parsedPosition = validPosition(position)

      if (!parsedPosition) {
        return {} as AggregatePlaceAttributes
      }

      const places = await Places.get().getPlaces({
        positions: [parsedPosition.join(",")],
        offset: 0,
        limit: 1,
      })
      return places.data[0]
    },
    [position],
    { callWithTruthyDeps: true, initialValue: {} as AggregatePlaceAttributes }
  )
}
