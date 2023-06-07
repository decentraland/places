import React from "react"

import useTrackLinkContext from "decentraland-gatsby/dist/context/Track/useTrackLinkContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"

import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import { explorerPlaceUrl } from "../../../entities/Place/utils"
import { SegmentPlace } from "../../../modules/segment"
import DislikeBox from "../../Button/DislikeBox"
import FavoriteBox from "../../Button/FavoriteBox"
import JumpInPositionButton from "../../Button/JumpInPositionButton"
import LikeBox from "../../Button/LikeBox"
import ShareBox from "../../Button/ShareBox"

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
  const placerUrl = explorerPlaceUrl(place)

  const handleJumpInTrack = useTrackLinkContext()

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
                  backgroundImage: `url(${place.image})`,
                }
              : {}
          }
        ></div>
        <div className="place-description__right-side-container">
          <div className="place-description__text-container">
            <h1>{place?.title}</h1>
            {place?.contact_name && (
              <p>
                {l("components.place_description.created_by")}{" "}
                <strong>{place.contact_name}</strong>
              </p>
            )}
          </div>
          <div className="place-description__buttons-container">
            <JumpInPositionButton
              href={placerUrl}
              loading={loading}
              onClick={handleJumpInTrack}
              data-event={SegmentPlace.JumpIn}
              data-place-id={place?.id}
              data-place={dataPlace}
            />
            <div className="place-description__box-wrapper">
              <LikeBox
                onClick={onClickLike}
                loading={loading || loadingLike}
                total={place?.likes}
                active={place?.user_like}
              />
              <DislikeBox
                onClick={onClickDislike}
                loading={loading || loadingDislike}
                total={place?.dislikes}
                active={place?.user_dislike}
              />
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
