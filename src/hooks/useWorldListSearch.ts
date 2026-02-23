import useTrackContext from "decentraland-gatsby/dist/context/Track/useTrackContext"
import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"

import Worlds from "../api/Worlds"
import { AggregatePlaceAttributes } from "../entities/Place/types"
import { SegmentPlace } from "../modules/segment"

export function useWorldListSearch(
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

      const result = await Worlds.get().getWorlds({
        ...options,
        search,
      })

      track(SegmentPlace.OverviewWorldsSearch, {
        resultsCount: result.total,
        top10: result.data.slice(0, 10),
        search,
        place: SegmentPlace.OverviewWorldsSearch,
      })

      return result
    },
    [options, search],
    { initialValue: { data: [] as AggregatePlaceAttributes[], total: 0 } }
  )
}
