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
    const result = await Places.get().getPlacesRecentlyUpdates(options)
    return result.data
  }, [options?.limit, options?.offset])
}

export function usePlaceListPopular(options?: {
  limit: number
  offset: number
}) {
  return useAsyncMemo(async () => {
    const result = await Places.get().getPlacesPopular(options)
    return result.data
  }, [options?.limit, options?.offset])
}

export function usePlaceListMyFavorites(options?: {
  limit: number
  offset: number
}) {
  const [account] = useAuthContext()
  return useAsyncMemo(async () => {
    if (!account) {
      return []
    }

    const result = await Places.get().getPlacesMyFavorites(options)
    return result.data
  }, [options?.limit, options?.offset, account])
}

export function usePlaceListPois(options?: { limit: number; offset: number }) {
  return useAsyncMemo(async () => {
    const pois = await getPois()
    if (!pois || pois.length === 0) {
      return []
    }

    const result = await Places.get().getPlacesPois(pois, options)
    return result.data
  }, [options?.limit, options?.offset])
}
