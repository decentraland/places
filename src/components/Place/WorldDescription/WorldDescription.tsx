import React from "react"

import useTrackLinkContext from "decentraland-gatsby/dist/context/Track/useTrackLinkContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"

import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import { explorerWorldUrl } from "../../../entities/Place/utils"
import WorldsLogo from "../../../images/worlds-logo.svg"
import { SegmentPlace } from "../../../modules/segment"
import DislikeBox from "../../Button/DislikeBox"
import FavoriteBox from "../../Button/FavoriteBox"
import JumpInPositionButton from "../../Button/JumpInPositionButton"
import LikeBox from "../../Button/LikeBox"
import ShareBox from "../../Button/ShareBox"

import "./WorldDescription.css"

export type WorldDescriptionProps = {
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

export default React.memo(function WorldDescription(
  props: WorldDescriptionProps
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
  const placerUrl = explorerWorldUrl(place)

  const handleJumpInTrack = useTrackLinkContext()

  return (
    <div
      className={TokenList.join(["world-description", loading && "loading"])}
    >
      <div className="world-description__top-container">
        <div
          className="world-description__cover"
          style={
            !loading && place?.image
              ? {
                  backgroundImage: `url(${place.image})`,
                }
              : {}
          }
        ></div>
        <div className="world-description__right-side-container">
          <div className="world-description__text-container">
            <div className="world-label__container">
              <img src={WorldsLogo} alt="Decentraland Worlds Logo" />
              <h3>
                {l("components.world_description.decentraland")}{" "}
                <span>{l("components.world_description.worlds")}</span>
              </h3>
            </div>
            <h1>{place?.title}</h1>
            {place?.contact_name && (
              <p>
                {l("components.place_description.created_by")}{" "}
                <strong>{place.contact_name}</strong>
              </p>
            )}
          </div>
          <div className="world-description__buttons-container">
            <JumpInPositionButton
              href={placerUrl}
              loading={loading}
              onClick={handleJumpInTrack}
              data-event={SegmentPlace.JumpIn}
              data-place-id={place?.id}
              data-place={dataPlace}
            />
            <div className="world-description__box-wrapper">
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