import useTrackContext from "decentraland-gatsby/dist/context/Track/useTrackContext"
import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"

import Places from "../api/Places"
import { AggregatePlaceAttributes } from "../entities/Place/types"
import { SegmentPlace } from "../modules/segment"

export function usePlaceListSearch(
  options: {
    limit: number
    offset: number
  },
  search: string
) {
  const track = useTrackContext()

  return useAsyncMemo(
    async () => {
      if (search.length < 3) {
        return { data: [], total: 0 }
      }

      const result = await Places.get().getPlaces({ ...options, search })

      track(SegmentPlace.OverviewPlacesSearch, {
        resultsCount: result.total,
        top10: result.data.slice(0, 10),
        search,
        place: SegmentPlace.OverviewPlacesSearch,
      })

      return { ...result }
    },
    [options, search],
    { initialValue: { data: [] as AggregatePlaceAttributes[], total: 0 } }
  )
}
