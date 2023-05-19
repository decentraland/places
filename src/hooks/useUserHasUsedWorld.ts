import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"

import Places from "../api/Places"

export function useUserHasUsedWorld() {
  const [account] = useAuthContext()
  return useAsyncMemo(
    async () => {
      if (!account) {
        return []
      }

      return Places.get().getUserHasUsedWorld(account)
    },
    [account],
    {
      callWithTruthyDeps: true,
      initialValue: [],
    }
  )
}
