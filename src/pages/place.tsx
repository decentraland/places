import React, { useCallback, useEffect, useMemo, useState } from "react"

import { withPrefix } from "gatsby"
import { Helmet } from "react-helmet"

import { useLocation } from "@gatsbyjs/reach-router"
import MaintenancePage from "decentraland-gatsby/dist/components/Layout/MaintenancePage"
import NotFound from "decentraland-gatsby/dist/components/Layout/NotFound"
import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useFeatureFlagContext from "decentraland-gatsby/dist/context/FeatureFlag/useFeatureFlagContext"
import useShareContext from "decentraland-gatsby/dist/context/Share/useShareContext"
import useTrackContext from "decentraland-gatsby/dist/context/Track/useTrackContext"
import isAdmin from "decentraland-gatsby/dist/entities/Auth/isAdmin"
import useAsyncTask from "decentraland-gatsby/dist/hooks/useAsyncTask"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { navigate } from "decentraland-gatsby/dist/plugins/intl"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import { Container } from "decentraland-ui/dist/components/Container/Container"

import { RatingButtonProps } from "../components/Button/RatingButton"
import ItemLayout from "../components/Layout/ItemLayout"
import Navigation from "../components/Layout/Navigation"
import ConfirmRatingModal from "../components/Modal/ConfirmRatingModal"
import ContentModerationModal from "../components/Modal/ContentModerationModal"
import PlaceDescription from "../components/Place/PlaceDescription/PlaceDescription"
import PlaceDetails from "../components/Place/PlaceDetails/PlaceDetails"
import { usePlaceFromParams } from "../hooks/usePlaceFromParams"
import usePlacesManager from "../hooks/usePlacesManager"
import { FeatureFlags } from "../modules/ff"
import locations from "../modules/locations"
import { getRating } from "../modules/rating"
import { SegmentPlace } from "../modules/segment"
import toCanonicalPosition from "../utils/position/toCanonicalPosition"

export type EventPageState = {
  updating: Record<string, boolean>
}

export default function PlacePage() {
  const l = useFormatMessage()
  const track = useTrackContext()
  const [share] = useShareContext()
  const location = useLocation()
  const [account] = useAuthContext()
  const admin = isAdmin(account)
  const [openContentModerationModal, setOpenContentModerationModal] =
    useState(false)
  const [openConfirmModal, setOpenConfirmModal] = useState(false)

  const params = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  )

  const [placeRetrived, placeRetrivedState] = usePlaceFromParams(params)

  const placeMemo = useMemo(
    () => (!placeRetrived ? [[]] : [[placeRetrived]]),
    [placeRetrived]
  )

  useEffect(() => {
    if (
      placeRetrived &&
      toCanonicalPosition(placeRetrived.base_position) !==
        params.get("position")
    ) {
      navigate(locations.place(placeRetrived.base_position), { replace: true })
    }
  }, [placeRetrived, params.get("position")])

  const [
    [[place]],
    {
      handleFavorite,
      handlingFavorite,
      handleLike,
      handlingLike,
      handleDislike,
      handlingDislike,
      handleRating,
    },
  ] = usePlacesManager(placeMemo)

  useEffect(() => {
    if (place) {
      setSelectedRate(getRating(place.content_rating))
    }
  }, [place])

  const [selectedRate, setSelectedRate] = useState<SceneContentRating>(
    getRating(place?.content_rating)
  )

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
          url:
            location.origin + withPrefix(locations.place(place.base_position)),
          thumbnail: place.image || undefined,
        })
      }
    },
    [place, track]
  )

  const [handlingChangeRating, handleChangeRating] = useAsyncTask(
    async (e: React.MouseEvent<any>) => {
      e.stopPropagation()
      e.preventDefault()
      if (selectedRate === place.content_rating) return

      setOpenContentModerationModal(false)

      await handleRating(place.id, selectedRate)

      setOpenConfirmModal(true)
    },
    [place, selectedRate, setOpenContentModerationModal, setOpenConfirmModal]
  )

  const handleRatingButton = useCallback(
    (e: React.MouseEvent<any>, ratingProps: RatingButtonProps) => {
      setSelectedRate(ratingProps.rating)
      const placeRating = getRating(
        place.content_rating,
        SceneContentRating.RATING_PENDING
      )
      if (placeRating !== ratingProps.rating) {
        setOpenContentModerationModal(true)
      }
    },
    [place, setSelectedRate, setOpenContentModerationModal]
  )

  const [ff] = useFeatureFlagContext()

  if (ff.flags[FeatureFlags.Maintenance]) {
    return <MaintenancePage />
  }

  if (
    placeRetrivedState.loaded &&
    !placeRetrivedState.loading &&
    !placeRetrived
  ) {
    return (
      <Container style={{ marginTop: "39px" }}>
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
      <Container style={{ marginTop: "39px" }}>
        <ItemLayout>
          <PlaceDescription
            place={place}
            onClickLike={async () =>
              handleLike(place?.id, place.user_like ? null : true)
            }
            onClickDislike={async () =>
              handleDislike(place?.id, place.user_dislike ? null : false)
            }
            onClickShare={async (e) => handleShare(e)}
            onClickFavorite={async () => handleFavorite(place?.id, place)}
            loading={placeRetrivedState.loading}
            loadingFavorite={handlingFavorite.has(place?.id)}
            loadingLike={handlingLike.has(place?.id)}
            loadingDislike={handlingDislike.has(place?.id)}
            dataPlace={SegmentPlace.Place}
          />
          <PlaceDetails
            place={place}
            loading={placeRetrivedState.loading}
            onChangeRating={handleRatingButton}
          />
        </ItemLayout>
      </Container>
      {admin && place && (
        <ContentModerationModal
          onOpen={() => setOpenContentModerationModal(true)}
          onClose={() => setOpenContentModerationModal(false)}
          open={openContentModerationModal}
          place={place}
          selectedRate={selectedRate}
          onActionClick={handleChangeRating}
        />
      )}
      {admin && place && (
        <ConfirmRatingModal
          open={openConfirmModal}
          selectedRate={selectedRate}
          sceneName={place.title!}
          onClose={() => setOpenConfirmModal(false)}
          loading={handlingChangeRating}
        />
      )}
    </>
  )
}
