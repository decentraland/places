import React, { useCallback, useContext } from "react"

import useTrackContext from "decentraland-gatsby/dist/context/Track/useTrackContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"

import { TrackingPlacesSearchContext } from "../../../context/TrackingContext"
import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import { SegmentPlace } from "../../../modules/segment"
import { getImageUrl } from "../../../utils/image"
import FavoriteBox from "../../Button/FavoriteBox"
import JumpInPositionButton from "../../Button/JumpInPositionButton"
import ShareBox from "../../Button/ShareBox"
import { Likes } from "../../Label/Likes/Likes"

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

  const handleTrack = useCallback(
    (data: Record<string, unknown>) => {
      track(SegmentPlace.JumpIn, {
        placeId: place?.id,
        place: dataPlace,
        trackingId: trackingId,
        has_launcher: data.has_launcher,
      })
    },
    [place, track, trackingId]
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
            <JumpInPositionButton
              loading={loading}
              place={place}
              onTrack={handleTrack}
            />
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
    </div>
  )
})
