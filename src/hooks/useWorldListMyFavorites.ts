import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"

import Places from "../api/Places"
import { AggregatePlaceAttributes } from "../entities/Place/types"

const defaultResult = {
  data: [] as AggregatePlaceAttributes[],
  ok: true,
  total: 0,
}

export function useWorldListMyFavorites(options: {
  limit: number
  offset: number
}) {
  const [account] = useAuthContext()
  return useAsyncMemo(
    async () => {
      if (!account) {
        return defaultResult
      }

      return Places.get().getWorldsMyFavorites(options)
    },
    [options, account],
    {
      callWithTruthyDeps: true,
      initialValue: defaultResult,
    }
  )
}
