import { useEffect, useMemo, useState } from "react"

import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useTrackContext from "decentraland-gatsby/dist/context/Track/useTrackContext"
import useAsyncTasks from "decentraland-gatsby/dist/hooks/useAsyncTasks"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"

import Places from "../api/Places"
import Worlds from "../api/Worlds"
import { isWorld } from "../entities/shared/entityTypes"
import { AggregateBaseEntityAttributes } from "../entities/shared/types"
import { updateEntityInList } from "../modules/arrays"
import { SegmentPlace } from "../modules/segment"

/**
 * Hook to manage entity interactions (favorites, likes, ratings) for both places and worlds.
 * Automatically detects entity type and calls the appropriate API.
 */
export default function useEntitiesManager<
  T extends AggregateBaseEntityAttributes
>(entitiesDefault: T[][]) {
  const [account, accountState] = useAuthContext()
  const track = useTrackContext()
  const [entities, setEntities] = useState(entitiesDefault)

  useEffect(() => {
    setEntities(entitiesDefault)
  }, [entitiesDefault])

  const [handlingFavorite, handleFavorite] = useAsyncTasks(
    async (
      id: string,
      entity: AggregateBaseEntityAttributes,
      tracking: Record<string, string> = {}
    ) => {
      if (account === null) {
        accountState.authorize()
      } else if (entity) {
        // Call the appropriate API based on entity type
        const favoritesResponse = isWorld(entity)
          ? await Worlds.get().updateWorldFavorite(id, !entity.user_favorite)
          : await Places.get().updateFavorite(id, !entity.user_favorite)

        if (favoritesResponse) {
          track(SegmentPlace.Favorite, {
            ...tracking,
            entityId: entity.id,
            entityType: isWorld(entity) ? "world" : "place",
            userFavorite: !entity.user_favorite,
          })

          const entitiesUpdated = entities.map((entityList) =>
            updateEntityInList(
              entityList as T[],
              entity.id,
              favoritesResponse as Partial<T>
            )
          )

          setEntities(entitiesUpdated)
        }
      }
    },
    [account, entities, track]
  )

  const likeDislikeHandler = async (
    id: string,
    like: boolean | null,
    entity?: AggregateBaseEntityAttributes
  ) => {
    if (account === null) {
      accountState.authorize()
    } else if (id) {
      // Find the entity to determine its type
      const targetEntity = entity || entities.flat().find((e) => e.id === id)

      // Call the appropriate API based on entity type
      const likesResponse =
        targetEntity && isWorld(targetEntity)
          ? await Worlds.get().updateWorldLike(id, like)
          : await Places.get().updateLike(id, like)

      if (likesResponse) {
        track(SegmentPlace.Like, {
          entityId: id,
          entityType: targetEntity && isWorld(targetEntity) ? "world" : "place",
          userLike: like,
        })

        const entitiesUpdated = entities.map((entityList) =>
          updateEntityInList(entityList as T[], id, likesResponse as Partial<T>)
        )

        setEntities(entitiesUpdated)
      }
    }
  }

  const [handlingLike, handleLike] = useAsyncTasks(
    (
      id: string,
      like: boolean | null,
      entity?: AggregateBaseEntityAttributes
    ) => likeDislikeHandler(id, like, entity),
    [account, entities, track]
  )

  const [handlingDislike, handleDislike] = useAsyncTasks(
    (
      id: string,
      like: boolean | null,
      entity?: AggregateBaseEntityAttributes
    ) => likeDislikeHandler(id, like, entity),
    [account, entities, track]
  )

  const [handlingRating, handleRating] = useAsyncTasks(
    async (
      id: string,
      rate: SceneContentRating,
      entity?: AggregateBaseEntityAttributes
    ) => {
      // Find the entity to determine its type
      const targetEntity = entity || entities.flat().find((e) => e.id === id)

      // Call the appropriate API based on entity type
      const ratingResponse =
        targetEntity && isWorld(targetEntity)
          ? await Worlds.get().updateWorldRating(id, { content_rating: rate })
          : await Places.get().updateRating(id, { content_rating: rate })

      if (ratingResponse) {
        const entitiesUpdated = entities.map((entityList) =>
          updateEntityInList(
            entityList as T[],
            id,
            ratingResponse as Partial<T>
          )
        )

        setEntities(entitiesUpdated)
      }
    },
    [entities]
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
    entities,
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
