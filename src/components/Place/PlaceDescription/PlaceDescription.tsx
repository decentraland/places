import React, { useCallback, useContext, useState } from "react"

import useTrackContext from "decentraland-gatsby/dist/context/Track/useTrackContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import env from "decentraland-gatsby/dist/utils/env"

import { TrackingPlacesSearchContext } from "../../../context/TrackingContext"
import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import { launchDesktopApp } from "../../../modules/desktop"
import { SegmentPlace } from "../../../modules/segment"
import { placeClientOptions } from "../../../modules/utils"
import { getImageUrl } from "../../../utils/image"
import FavoriteBox from "../../Button/FavoriteBox"
import JumpInPositionButton from "../../Button/JumpInPositionButton"
import ShareBox from "../../Button/ShareBox"
import { Likes } from "../../Label/Likes/Likes"
import DownloadModal from "../../Modal/DownloadModal"

import "./PlaceDescription.css"

export type PlaceDescriptionProps = {
  place: AggregatePlaceAttributes
  onClickFavorite: (e: React.MouseEvent<HTMLButtonElement>) => void
  onClickLike: (e: React.MouseEvent<HTMLButtonElement>) => {}
  onClickDislike: (e: React.MouseEvent<HTMLButtonElement>) => {}
  onClickShare: (e: React.MouseEvent<HTMLButtonElement>) => {}
  dataPlace: SegmentPlace
  loading?: boolean
  loadingLike?: boolean
  loadingDislike?: boolean
  loadingFavorite?: boolean
}

export default React.memo(function PlaceDescription(
  props: PlaceDescriptionProps
) {
  const {
    place,
    onClickLike,
    onClickDislike,
    onClickShare,
    onClickFavorite,
    dataPlace,
    loading,
    loadingLike,
    loadingDislike,
    loadingFavorite,
  } = props
  const l = useFormatMessage()
  const [trackingId] = useContext(TrackingPlacesSearchContext)

  const track = useTrackContext()
  const [showModal, setShowModal] = useState(false)

  let hasDecentralandLauncher: null | boolean = null

  const handleClick = useCallback(
    async function (e: React.MouseEvent<HTMLButtonElement>) {
      e.stopPropagation()
      e.preventDefault()
      if (event) {
        hasDecentralandLauncher = await launchDesktopApp(
          placeClientOptions(place)
        )

        !hasDecentralandLauncher && setShowModal(true)
      }

      track(SegmentPlace.JumpIn, {
        placeId: place?.id,
        place: dataPlace,
        trackingId: trackingId,
        has_laucher: !!hasDecentralandLauncher,
      })
    },
    [place, track, trackingId]
  )

  const handleModalClick = useCallback(
    async function (e: React.MouseEvent<HTMLButtonElement>) {
      e.stopPropagation()
      e.preventDefault()

      window.open(
        env("DECENTRALAND_DOWNLOAD_URL", "https://decentraland.org/download"),
        "_blank"
      )
    },
    [track, hasDecentralandLauncher]
  )

  return (
    <div
      className={TokenList.join(["place-description", loading && "loading"])}
    >
      <div className="place-description__top-container">
        <div
          className="place-description__cover"
          style={
            !loading && place?.image
              ? {
                  backgroundImage: `url(${getImageUrl(place.image)})`,
                }
              : {}
          }
        ></div>
        <div className="place-description__right-side-container">
          <div className="place-description__title-container">
            <div className="place-description__text-container">
              <h1>{place?.title}</h1>
              {place?.contact_name && (
                <p>
                  {l("components.place_description.created_by")}{" "}
                  <strong>{place.contact_name}</strong>
                </p>
              )}
            </div>
          </div>
          <div className="place-description__buttons-container">
            {!loading && (
              <Likes
                likeRate={place?.like_rate ?? null}
                likesCount={(place?.likes || 0) + (place?.dislikes || 0)}
                handlers={{
                  like: {
                    onClick: onClickLike,
                    active: place?.user_like,
                    loading: loadingLike,
                  },
                  dislike: {
                    onClick: onClickDislike,
                    active: place?.user_dislike,
                    loading: loadingDislike,
                  },
                }}
              />
            )}
            <JumpInPositionButton loading={loading} onClick={handleClick} />
            <div className="place-description__box-wrapper">
              <ShareBox onClick={onClickShare} loading={loading} />
              <FavoriteBox
                onClick={onClickFavorite}
                loading={loading || loadingFavorite}
                active={place?.user_favorite}
                dataPlace={dataPlace}
              />
            </div>
          </div>
        </div>
      </div>
      <DownloadModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onModalClick={handleModalClick}
      />
    </div>
  )
})
