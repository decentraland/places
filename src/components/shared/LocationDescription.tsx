import React from "react"

import useTrackLinkContext from "decentraland-gatsby/dist/context/Track/useTrackLinkContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"

import { AggregatePlaceAttributes } from "../../entities/Place/types"
import { explorerPlaceUrl } from "../../entities/Place/utils"
import { SegmentPlace } from "../../modules/segment"
import FavoriteBox from "../Button/FavoriteBox"
import JumpInPositionButton from "../Button/JumpInPositionButton"
import ShareBox from "../Button/ShareBox"
import WorldLabel from "../World/WorldLabel/WorldLabel"
import { Likes } from "./Likes"

import "./LocationDescription.css"

export type LocationDescriptionProps = {
  type: "place" | "world"
  location: AggregatePlaceAttributes
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

export default React.memo(function LocationDescription(
  props: LocationDescriptionProps
) {
  const {
    type,
    location,
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
  const placerUrl = explorerPlaceUrl(location)

  const handleJumpInTrack = useTrackLinkContext()

  return (
    <div
      className={TokenList.join(["place-description", loading && "loading"])}
    >
      <div className="place-description__top-container">
        <div
          className="place-description__cover"
          style={
            !loading && location?.image
              ? {
                  backgroundImage: `url(${location.image})`,
                }
              : {}
          }
        ></div>
        <div className="place-description__right-side-container">
          <div className="place-description__title-container">
            {!loading && type == "world" && <WorldLabel />}
            <div className="place-description__text-container">
              <h1>{location?.title}</h1>
              {location?.contact_name && (
                <p>
                  {l("components.place_description.created_by")}{" "}
                  <strong>{location.contact_name}</strong>
                </p>
              )}
            </div>
          </div>
          <div className="place-description__buttons-container">
            <Likes
              likeRate={location?.like_rate}
              likesCount={location?.likes}
              handlers={{
                like: {
                  onClick: onClickLike,
                  active: location?.user_like,
                  loading: loading || loadingLike,
                },
                dislike: {
                  onClick: onClickDislike,
                  active: location?.user_dislike,
                  loading: loading || loadingDislike,
                },
              }}
            />
            <JumpInPositionButton
              href={placerUrl}
              loading={loading}
              onClick={handleJumpInTrack}
              data-event={SegmentPlace.JumpIn}
              data-place-id={location?.id}
              data-place={dataPlace}
            />
            <div className="place-description__box-wrapper">
              <ShareBox onClick={onClickShare} loading={loading} />
              <FavoriteBox
                onClick={onClickFavorite}
                loading={loading || loadingFavorite}
                active={location?.user_favorite}
                dataPlace={dataPlace}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
