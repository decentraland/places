import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"
import isUUID from "validator/lib/isUUID"

import Places from "../api/Places"
import { getPois } from "../modules/pois"

export function usePlaceId(placeId?: string | null) {
  return useAsyncMemo(
    async () => {
      if (!placeId || !isUUID(placeId)) {
        return null
      }

      return Places.get().getPlaceById(placeId)
    },
    [placeId],
    { callWithTruthyDeps: true }
  )
}

export function usePlaceListRecentlyUpdates(options?: {
  limit: number
  offset: number
}) {
  return useAsyncMemo(async () => {
    return Places.get().getPlacesRecentlyUpdates(options)
  }, [options?.limit, options?.offset])
}

export function usePlaceListPopular(options?: {
  limit: number
  offset: number
}) {
  return useAsyncMemo(async () => {
    return Places.get().getPlacesPopular(options)
  }, [options?.limit, options?.offset])
}

export function usePlaceListMyFavorites(options?: {
  limit: number
  offset: number
}) {
  const [account] = useAuthContext()
  return useAsyncMemo(async () => {
    return account && Places.get().getPlacesMyFavorites(options)
  }, [options?.limit, options?.offset, account])
}

export function usePlaceListPois(options?: { limit: number; offset: number }) {
  return useAsyncMemo(async () => {
    const pois = await getPois()
    return pois && pois.length > 0 && Places.get().getPlacesPois(pois, options)
  }, [options?.limit, options?.offset])
}
