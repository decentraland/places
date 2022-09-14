import React, { useCallback, useMemo } from "react"

import { Helmet } from "react-helmet"

import { useLocation } from "@gatsbyjs/reach-router"
import NotFound from "decentraland-gatsby/dist/components/Layout/NotFound"
import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"
import useAsyncTask from "decentraland-gatsby/dist/hooks/useAsyncTask"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Container } from "decentraland-ui/dist/components/Container/Container"
import { Loader } from "decentraland-ui/dist/components/Loader/Loader"
import { intersects } from "radash/dist/array"

import Places from "../api/Places"
import ItemLayout from "../components/Layout/ItemLayout"
import PlaceDescription from "../components/Place/PlaceDescription/PlaceDescription"
import PlaceRealmActivity, {
  ReamlActivity,
} from "../components/Place/PlaceRealmActivity/PlaceRealmActivity"
import PlaceStats from "../components/Place/PlaceStats/PlaceStats"
import { usePlaceId } from "../hooks/Place"
import locations from "../modules/locations"
import { getPois } from "../modules/pois"
import { getServers } from "../modules/servers"

import "./index.css"

export type EventPageState = {
  updating: Record<string, boolean>
}

export default function PlacePage() {
  const l = useFormatMessage()
  const [account, accountState] = useAuthContext()
  const location = useLocation()
  const params = new URLSearchParams(location.search)

  const [place, placeState] = usePlaceId(params.get("id"))
  const [pois] = useAsyncMemo(getPois)
  const [servers] = useAsyncMemo(getServers)
  const [handlingFavorite, handleFavorite] = useAsyncTask(async () => {
    if (account === null) {
      accountState.select()
    } else if (place) {
      const favoritesResponse = await Places.get().updateFavorite(
        place.id,
        !place.user_favorite
      )
      if (favoritesResponse) {
        placeState.set({ ...place, ...favoritesResponse })
      }
    }
  }, [place])

  const [handlingLike, handleLike] = useAsyncTask(
    async (like: boolean | null) => {
      if (account === null) {
        accountState.select()
      } else if (place) {
        const LikesResponse = await Places.get().updateLike(place.id, like)
        placeState.set({ ...place, ...LikesResponse })
      }
    },
    [account, place]
  )

  const [handlingShare, share] = useAsyncTask(async () => {
    if (place) {
      try {
        await (navigator as any).share({
          title: place.title,
          text: place.description,
          url: location.origin + locations.place(place.id),
        })
      } catch (err) {
        console.error(err)
      }
    }
  }, [place])

  const handleShare = useCallback((e: React.MouseEvent<any>) => {
    e.preventDefault()
    e.stopPropagation()

    if (typeof navigator !== "undefined" && (navigator as any).share) {
      share()
    }
  }, [])

  const isPoi = useMemo(
    () => intersects(place?.positions || [], pois || []),
    [place, pois]
  )

  const placeRealmActivities: ReamlActivity[] = useMemo(() => {
    if (place && servers) {
      const positions = new Set(place.positions)
      return servers
        .filter((server) => server.status)
        .map((server) => {
          let peersCount: number[] = []
          if (server.stats) {
            peersCount = server.stats.parcels.map((parcel) => {
              const isParcelInPlace = positions.has(
                `${parcel.parcel.x},${parcel.parcel.y}`
              )
              if (isParcelInPlace) {
                return parcel.peersCount
              } else {
                return 0
              }
            })
          }

          return {
            name: server.status!.name,
            activity: peersCount.reduce(
              (partialSum: number, current: number) => partialSum + current,
              0
            ),
          }
        })
    } else {
      return []
    }
  }, [place, servers])

  const activitySum = useMemo(() => {
    let activitySum = 0
    placeRealmActivities.forEach((realm) => (activitySum += realm.activity))
    return activitySum
  }, [placeRealmActivities])

  const loading = accountState.loading || placeState.loading

  if (!loading && !place) {
    return (
      <Container style={{ paddingTop: "75px" }}>
        <ItemLayout full>
          <NotFound />
        </ItemLayout>
      </Container>
    )
  }

  return (
    <>
      <Helmet>
        <title>{place?.title || l("social.home.title") || ""}</title>
        <meta
          name="description"
          content={place?.description || l("social.home.description") || ""}
        />

        <meta
          property="og:title"
          content={place?.title || l("social.home.title") || ""}
        />
        <meta
          property="og:description"
          content={place?.description || l("social.home.description") || ""}
        />
        <meta
          property="og:image"
          content={place?.image || l("social.home.image") || ""}
        />
        <meta property="og:site" content={l("social.home.site") || ""} />

        <meta
          name="twitter:title"
          content={place?.description || l("social.home.title") || ""}
        />
        <meta
          name="twitter:description"
          content={place?.description || l("social.home.description") || ""}
        />
        <meta
          name="twitter:image"
          content={place?.image || l("social.home.image") || ""}
        />
        <meta
          name="twitter:card"
          content={place ? "summary_large_image" : l("social.home.card") || ""}
        />
        <meta name="twitter:creator" content={l("social.home.creator") || ""} />
        <meta name="twitter:site" content={l("social.home.site") || ""} />
      </Helmet>
      <Container style={{ paddingTop: "75px" }}>
        <ItemLayout full>
          {loading && (
            <Loader active size="massive" style={{ position: "relative" }} />
          )}
          {!loading && place && (
            <>
              <PlaceDescription
                place={place}
                onClickLike={async () =>
                  handleLike(place.user_like ? null : true)
                }
                onClickDislike={async () =>
                  handleLike(place.user_dislike ? null : false)
                }
                onClickShare={async (e) => handleShare(e)}
                onClickFavorite={handleFavorite}
                loading={
                  loading || handlingFavorite || handlingLike || handlingShare
                }
              />
              <PlaceStats
                place={place}
                users={activitySum}
                loading={loading}
                poi={isPoi}
              />
              {!loading && placeRealmActivities.length > 0 && (
                <PlaceRealmActivity
                  place={place}
                  loading={loading}
                  activities={placeRealmActivities}
                />
              )}
            </>
          )}
        </ItemLayout>
      </Container>
    </>
  )
}
