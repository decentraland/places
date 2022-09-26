import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"

import Places from "../api/Places"
import { AggregatePlaceAttributes } from "../entities/Place/types"

export function usePlaceListMyFavorites(options?: {
  limit: number
  offset: number
}) {
  const [account] = useAuthContext()
  return useAsyncMemo(
    async () => {
      if (!account) {
        return []
      }

      return Places.get().getPlacesMyFavorites(options)
    },
    [options?.limit, options?.offset, account],
    { initialValue: [] as AggregatePlaceAttributes[] }
  )
}
