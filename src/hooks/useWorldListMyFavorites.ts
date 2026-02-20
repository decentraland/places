import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"

import Worlds from "../api/Worlds"
import { AggregateWorldAttributes } from "../entities/World/types"

const defaultResult = {
  data: [] as AggregateWorldAttributes[],
  ok: true,
  total: 0,
}

export function useWorldListMyFavorites(
  options: {
    limit: number
    offset: number
  },
  search: string
) {
  const [account] = useAuthContext()
  return useAsyncMemo(
    async () => {
      if (!account) {
        return defaultResult
      }

      return Worlds.get().getWorldsMyFavorites({ ...options, search })
    },
    [options, account, search],
    {
      callWithTruthyDeps: false,
      initialValue: defaultResult,
    }
  )
}
