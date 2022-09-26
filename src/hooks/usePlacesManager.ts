import React, { useEffect, useMemo, useState } from "react"

import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useAsyncTasks from "decentraland-gatsby/dist/hooks/useAsyncTasks"

import Places from "../api/Places"
import { AggregatePlaceAttributes } from "../entities/Place/types"
import { updatePlaceInPlaceList as updateInList } from "../modules/arrays"

export default function usePlacesManager(
  placesDefault: AggregatePlaceAttributes[][]
) {
  const [account, accountState] = useAuthContext()

  const [places, setPlaces] = useState(placesDefault)

  useEffect(() => {
    setPlaces(placesDefault)
  }, [placesDefault])

  const [handlingFavorite, handleFavorite] = useAsyncTasks(
    async (id, place: AggregatePlaceAttributes) => {
      if (account === null) {
        accountState.select()
      } else if (place) {
        const favoritesResponse = await Places.get().updateFavorite(
          id,
          !place.user_favorite
        )
        if (favoritesResponse) {
          const placesUpdated = places.map(
            (placeToUpdate) =>
              updateInList(placeToUpdate, place.id, favoritesResponse),
            [places]
          )

          setPlaces(placesUpdated)
        }
      }
    },
    [account, places]
  )

  const likeDislikeHandler = async (id: string, like: boolean | null) => {
    if (account === null) {
      accountState.select()
    } else if (id) {
      const LikesResponse = await Places.get().updateLike(id, like)
      if (LikesResponse) {
        const placesUpdated = places.map(
          (placeToUpdate) => updateInList(placeToUpdate, id, LikesResponse),
          [places]
        )

        setPlaces(placesUpdated)
      }
    }
  }

  const [handlingLike, handleLike] = useAsyncTasks(likeDislikeHandler, [
    account,
    places,
  ])

  const [handlingDislike, handleDislike] = useAsyncTasks(likeDislikeHandler, [
    account,
    places,
  ])

  const modifyingFavorite = useMemo(
    () => new Set(handlingFavorite),
    [handlingFavorite]
  )
  const modifyingLike = useMemo(() => new Set(handlingLike), [handlingLike])
  const modifyingDislike = useMemo(
    () => new Set(handlingDislike),
    [handlingDislike]
  )

  return [
    places,
    {
      handleFavorite,
      handleLike,
      handleDislike,
      handlingFavorite: modifyingFavorite,
      handlingLike: modifyingLike,
      handlingDislike: modifyingDislike,
    },
  ] as const
}
