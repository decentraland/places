import { useEffect, useMemo, useState } from "react"

import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useTrackContext from "decentraland-gatsby/dist/context/Track/useTrackContext"
import useAsyncTasks from "decentraland-gatsby/dist/hooks/useAsyncTasks"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import Places from "../api/Places"
import { AggregatePlaceAttributes } from "../entities/Place/types"
import { updatePlaceInPlaceList as updateInList } from "../modules/arrays"
import { SegmentPlace } from "../modules/segment"

export default function usePlacesManager(
  placesDefault: AggregatePlaceAttributes[][]
) {
  const [account, accountState] = useAuthContext()
  const track = useTrackContext()
  const [places, setPlaces] = useState(placesDefault)

  useEffect(() => {
    setPlaces(placesDefault)
  }, [placesDefault])

  const [handlingFavorite, handleFavorite] = useAsyncTasks(
    async (
      id,
      place: AggregatePlaceAttributes,
      tracking: Record<string, string> = {}
    ) => {
      if (account === null) {
        accountState.select()
      } else if (place) {
        const favoritesResponse = await Places.get().updateFavorite(
          id,
          !place.user_favorite
        )
        if (favoritesResponse) {
          track(SegmentPlace.Favorite, {
            ...tracking,
            placeId: place.id,
            placeUserFavorite: !place.user_favorite,
          })
          const placesUpdated = places.map(
            (placeToUpdate) =>
              updateInList(placeToUpdate, place.id, favoritesResponse),
            [places]
          )

          setPlaces(placesUpdated)
        }
      }
    },
    [account, places, track]
  )

  const likeDislikeHandler = async (id: string, like: boolean | null) => {
    if (account === null) {
      accountState.select()
    } else if (id) {
      const LikesResponse = await Places.get().updateLike(id, like)
      if (LikesResponse) {
        track(SegmentPlace.Like, {
          placeId: id,
          placeUserLike: like,
        })

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
    track,
  ])

  const [handlingDislike, handleDislike] = useAsyncTasks(likeDislikeHandler, [
    account,
    places,
    track,
  ])

  const [handlingRating, handleRating] = useAsyncTasks(
    async (id, rate: SceneContentRating) => {
      const ratingResponse = await Places.get().updateRating(id, {
        content_rating: rate as SceneContentRating,
      })

      if (ratingResponse) {
        const placesUpdated = places.map(
          (placeToUpdate) => updateInList(placeToUpdate, id, ratingResponse),
          [places]
        )

        setPlaces(placesUpdated)
      }
    },
    [places]
  )

  const modifyingFavorite = useMemo(
    () => new Set(handlingFavorite),
    [handlingFavorite]
  )
  const modifyingLike = useMemo(() => new Set(handlingLike), [handlingLike])

  const modifyingDislike = useMemo(
    () => new Set(handlingDislike),
    [handlingDislike]
  )

  const modifyingRating = useMemo(
    () => new Set(handlingRating),
    [handlingRating]
  )

  return [
    places,
    {
      handleFavorite,
      handleLike,
      handleDislike,
      handleRating,
      handlingFavorite: modifyingFavorite,
      handlingLike: modifyingLike,
      handlingDislike: modifyingDislike,
      handlingRating: modifyingRating,
    },
  ] as const
}
