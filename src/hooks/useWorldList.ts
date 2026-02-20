import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"

import Worlds from "../api/Worlds"
import { AggregatePlaceAttributes } from "../entities/Place/types"

export function useWorldList(options?: { limit: number; offset: number }) {
  return useAsyncMemo(
    async () => {
      const result = await Worlds.get().getWorlds(options)
      return result.data
    },
    [options?.limit, options?.offset],
    { initialValue: [] as AggregatePlaceAttributes[] }
  )
}
