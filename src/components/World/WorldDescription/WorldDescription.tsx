import React from "react"

import useTrackLinkContext from "decentraland-gatsby/dist/context/Track/useTrackLinkContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"

import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import { explorerPlaceUrl } from "../../../entities/Place/utils"
import { SegmentPlace } from "../../../modules/segment"
import FavoriteBox from "../../Button/FavoriteBox"
import JumpInPositionButton from "../../Button/JumpInPositionButton"
import ShareBox from "../../Button/ShareBox"
import { Likes } from "../../Label/Likes/Likes"
import WorldLabel from "../WorldLabel/WorldLabel"

import "./WorldDescription.css"

export type WorldDescriptionProps = {
  world: AggregatePlaceAttributes
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
    world,
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
  const placerUrl = explorerPlaceUrl(world)

  const handleJumpInTrack = useTrackLinkContext()

  return (
    <div
      className={TokenList.join(["world-description", loading && "loading"])}
    >
      <div className="world-description__top-container">
        <div
          className="world-description__cover"
          style={
            !loading && world?.image
              ? {
                  backgroundImage: `url(${world.image})`,
                }
              : {}
          }
        ></div>
        <div className="world-description__right-side-container">
          <div className="world-description__title-container">
            <WorldLabel />
            <div className="world-description__text-container">
              <h1>{world?.title}</h1>
              {world?.contact_name && (
                <p>
                  {l("components.place_description.created_by")}{" "}
                  <strong>{world.contact_name}</strong>
                </p>
              )}
            </div>
          </div>
          <div className="world-description__buttons-container">
            {!loading && (
              <Likes
                likeRate={world?.like_rate || 0}
                likesCount={(world?.likes || 0) + (world?.dislikes || 0)}
                handlers={{
                  like: {
                    onClick: onClickLike,
                    active: world?.user_like,
                    loading: loading || loadingLike,
                  },
                  dislike: {
                    onClick: onClickDislike,
                    active: world?.user_dislike,
                    loading: loading || loadingDislike,
                  },
                }}
              />
            )}
            <JumpInPositionButton
              href={placerUrl}
              loading={loading}
              onClick={handleJumpInTrack}
              data-event={SegmentPlace.JumpIn}
              data-place-id={world?.id}
              data-place={dataPlace}
            />
            <div className="world-description__box-wrapper">
              <ShareBox onClick={onClickShare} loading={loading} />
              <FavoriteBox
                onClick={onClickFavorite}
                loading={loading || loadingFavorite}
                active={world?.user_favorite}
                dataPlace={dataPlace}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
