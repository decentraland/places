import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"

import Worlds from "../api/Worlds"

export function useWorldFromParams(params: URLSearchParams) {
  return useAsyncMemo(
    async () => {
      if (params.get("id")) {
        return Worlds.get().getWorldById(params.get("id")!)
      } else if (params.get("name")) {
        const worlds = await Worlds.get().getWorlds({
          names: [params.get("name")!],
          offset: 0,
          limit: 1,
        })
        return worlds.data[0]
      }

      return null
    },
    [params],
    { callWithTruthyDeps: true, initialValue: null }
  )
}
