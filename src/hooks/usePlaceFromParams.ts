import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"
import isUUID from "validator/lib/isUUID"

import Places from "../api/Places"
import toCanonicalPosition from "../utils/position/toCanonicalPosition"

export function usePlaceFromParams(
  params: URLSearchParams,
  deps: React.DependencyList = []
) {
  return useAsyncMemo(
    async () => {
      if (params.get("id")) {
        if (!isUUID(params.get("id")!)) {
          null
        }

        return Places.get().getPlaceById(params.get("id")!)
      } else if (params.get("position")) {
        const parsedPosition = toCanonicalPosition(params.get("position"), ",")
        if (!parsedPosition) {
          return null
        }

        const places = await Places.get().getPlaces({
          positions: [parsedPosition],
          offset: 0,
          limit: 1,
        })

        const place = places.data[0]

        return place
      }

      return null
    },
    [params, ...deps],
    { initialValue: null }
  )
}
