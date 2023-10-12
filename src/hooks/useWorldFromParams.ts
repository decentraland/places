import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"
import isUUID from "validator/lib/isUUID"

import Places from "../api/Places"

export function useWorldFromParams(params: URLSearchParams) {
  return useAsyncMemo(
    async () => {
      if (params.get("id")) {
        if (!isUUID(params.get("id")!)) {
          return null
        }

        return Places.get().getPlaceById(params.get("id")!)
      } else if (params.get("name")) {
        const places = await Places.get().getWorlds({
          names: [params.get("name")!],
          offset: 0,
          limit: 1,
        })
        return places.data[0]
      }

      return null
    },
    [params],
    { callWithTruthyDeps: true, initialValue: null }
  )
}
