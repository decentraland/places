import React, { useCallback, useMemo } from "react"

import { Helmet } from "react-helmet"

import { useLocation } from "@gatsbyjs/reach-router"
import NotFound from "decentraland-gatsby/dist/components/Layout/NotFound"
import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useTrackContext from "decentraland-gatsby/dist/context/Track/useTrackContext"
import useAsyncMemo from "decentraland-gatsby/dist/hooks/useAsyncMemo"
import useAsyncTask from "decentraland-gatsby/dist/hooks/useAsyncTask"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Container } from "decentraland-ui/dist/components/Container/Container"
import { Loader } from "decentraland-ui/dist/components/Loader/Loader"
import { intersects, sum } from "radash/dist/array"

import ItemLayout from "../components/Layout/ItemLayout"
import PlaceDescription from "../components/Place/PlaceDescription/PlaceDescription"
import PlaceRealmActivity, {
  ReamlActivity,
} from "../components/Place/PlaceRealmActivity/PlaceRealmActivity"
import PlaceStats from "../components/Place/PlaceStats/PlaceStats"
import { usePlaceId } from "../hooks/usePlaceId"
import usePlacesManager from "../hooks/usePlacesManager"
import locations from "../modules/locations"
import { getPois } from "../modules/pois"
import { SegmentPlace } from "../modules/segment"
import { getServers } from "../modules/servers"

import "./place.css"

export type EventPageState = {
  updating: Record<string, boolean>
}

export default function PlacePage() {
  const l = useFormatMessage()
  const track = useTrackContext()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [account, accountState] = useAuthContext()
  const location = useLocation()
  const params = new URLSearchParams(location.search)

  const [placeRetrived] = usePlaceId(params.get("id"))
  const [pois] = useAsyncMemo(getPois)
  const [servers] = useAsyncMemo(getServers)

  const a = useMemo(() => [[placeRetrived]], [placeRetrived])
  const [
    [[place]],
    {
      handleFavorite,
      handlingFavorite,
      handleLike,
      handlingLike,
      handleDislike,
      handlingDislike,
    },
  ] = usePlacesManager(a)

  const [handlingShare, share] = useAsyncTask(async () => {
    if (place) {
      try {
        await (navigator as any).share({
          title: place.title,
          text: place.description,
          url: location.origin + locations.place(place.id),
        })
        track(SegmentPlace.Share, {
          placeId: place.id,
        })
      } catch (err) {
        console.error(err)
      }
    }
  }, [place, track])

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
            activity: sum(peersCount, (number) => number),
          }
        })
    } else {
      return []
    }
  }, [place, servers])

  const activitySum = useMemo(
    () => sum(placeRealmActivities, (f) => f.activity),
    [placeRealmActivities]
  )

  const loading = accountState.loading

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
                  handleLike(place.id, place.user_like ? null : true)
                }
                onClickDislike={async () =>
                  handleDislike(place.id, place.user_dislike ? null : false)
                }
                onClickShare={async (e) => handleShare(e)}
                onClickFavorite={async () => handleFavorite(place.id, place)}
                loading={loading || handlingShare}
                loadingFavorite={handlingFavorite.has(place.id)}
                loadingLike={handlingLike.has(place.id)}
                loadingDislike={handlingDislike.has(place.id)}
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
