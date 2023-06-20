import React, { useCallback, useEffect, useMemo } from "react"

import { Helmet } from "react-helmet"

import { useLocation } from "@gatsbyjs/reach-router"
import MaintenancePage from "decentraland-gatsby/dist/components/Layout/MaintenancePage"
import NotFound from "decentraland-gatsby/dist/components/Layout/NotFound"
import useFeatureFlagContext from "decentraland-gatsby/dist/context/FeatureFlag/useFeatureFlagContext"
import useShareContext from "decentraland-gatsby/dist/context/Share/useShareContext"
import useTrackContext from "decentraland-gatsby/dist/context/Track/useTrackContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { navigate } from "decentraland-gatsby/dist/plugins/intl"
import { Container } from "decentraland-ui/dist/components/Container/Container"

import ItemLayout from "../components/Layout/ItemLayout"
import Navigation from "../components/Layout/Navigation"
import WorldDescription from "../components/World/WorldDescription/WorldDescription"
import WorldDetails from "../components/World/WorldDetails/WorldDetails"
import usePlacesManager from "../hooks/usePlacesManager"
import { useWorldFromParams } from "../hooks/useWorldFromParams"
import { FeatureFlags } from "../modules/ff"
import locations from "../modules/locations"
import { SegmentPlace } from "../modules/segment"

export type EventPageState = {
  updating: Record<string, boolean>
}

export default function WorldPage() {
  const l = useFormatMessage()
  const track = useTrackContext()
  const [share] = useShareContext()
  const location = useLocation()

  const params = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  )

  const [worldRetrived, worldRetrivedState] = useWorldFromParams(params)

  const placeMemo = useMemo(
    () => (!worldRetrived ? [[]] : [[worldRetrived]]),
    [worldRetrived]
  )

  useEffect(() => {
    if (worldRetrived && worldRetrived.world_name !== params.get("name")) {
      navigate(locations.place(worldRetrived.world_name!), { replace: true })
    }
  }, [worldRetrived, params.get("name")])

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
  ] = usePlacesManager(placeMemo)

  const handleShare = useCallback(
    (e: React.MouseEvent<any>) => {
      e.preventDefault()
      e.stopPropagation()
      if (place) {
        const shareableText = place.description
          ? `${place.title} - ${place.description}`
          : place.title
        share({
          title: place.title || undefined,
          text: `${l("general.place_share")}${shareableText}`,
          url: location.origin + locations.place(place.base_position),
          thumbnail: place.image || undefined,
        })
      }
    },
    [place, track]
  )

  const [ff] = useFeatureFlagContext()

  if (ff.flags[FeatureFlags.Maintenance]) {
    return <MaintenancePage />
  }

  if (
    worldRetrivedState.loaded &&
    !worldRetrivedState.loading &&
    !worldRetrived
  ) {
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
        <title>{`${place?.title ? place?.title + " | " : ""}${l(
          "social.place.title"
        )}`}</title>
        <meta
          name="description"
          content={place?.description || l("social.place.description") || ""}
        />

        <meta
          property="og:title"
          content={place?.title || l("social.place.title") || ""}
        />
        <meta
          property="og:description"
          content={place?.description || l("social.place.description") || ""}
        />
        <meta
          property="og:image"
          content={place?.image || l("social.place.image") || ""}
        />
        <meta property="og:site" content={l("social.place.site") || ""} />

        <meta
          name="twitter:title"
          content={place?.description || l("social.place.title") || ""}
        />
        <meta
          name="twitter:description"
          content={place?.description || l("social.place.description") || ""}
        />
        <meta
          name="twitter:image"
          content={place?.image || l("social.place.image") || ""}
        />
        <meta
          name="twitter:card"
          content={place ? "summary_large_image" : l("social.place.card") || ""}
        />
        <meta
          name="twitter:creator"
          content={l("social.place.creator") || ""}
        />
        <meta name="twitter:site" content={l("social.place.site") || ""} />
      </Helmet>
      <Navigation />
      <Container style={{ paddingTop: "75px" }}>
        <ItemLayout>
          <WorldDescription
            place={place}
            onClickLike={async () =>
              handleLike(place?.id, place.user_like ? null : true)
            }
            onClickDislike={async () =>
              handleDislike(place?.id, place.user_dislike ? null : false)
            }
            onClickShare={async (e) => handleShare(e)}
            onClickFavorite={async () => handleFavorite(place?.id, place)}
            loading={worldRetrivedState.loading}
            loadingFavorite={handlingFavorite.has(place?.id)}
            loadingLike={handlingLike.has(place?.id)}
            loadingDislike={handlingDislike.has(place?.id)}
            dataPlace={SegmentPlace.Place}
          />
          <WorldDetails place={place} loading={worldRetrivedState.loading} />
        </ItemLayout>
      </Container>
    </>
  )
}
