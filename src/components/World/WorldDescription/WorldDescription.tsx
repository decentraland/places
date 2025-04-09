import React, { useCallback, useState } from "react"

import DownloadModal from "decentraland-gatsby/dist/components/Modal/DownloadModal"
import useTrackContext from "decentraland-gatsby/dist/context/Track/useTrackContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import env from "decentraland-gatsby/dist/utils/env"

import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import { launchDesktopApp } from "../../../modules/desktop"
import { SegmentPlace } from "../../../modules/segment"
import { placeClientOptions } from "../../../modules/utils"
import { getImageUrl } from "../../../utils/image"
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

  const track = useTrackContext()
  const [showModal, setShowModal] = useState(false)

  let hasDecentralandLauncher: null | boolean = null

  const handleClick = useCallback(
    async function (e: React.MouseEvent<HTMLButtonElement>) {
      e.stopPropagation()
      e.preventDefault()
      if (event) {
        hasDecentralandLauncher = await launchDesktopApp(
          placeClientOptions(world)
        )

        !hasDecentralandLauncher && setShowModal(true)
      }

      track(SegmentPlace.JumpIn, {
        event: SegmentPlace.JumpIn,
        placeId: world?.id,
        place: dataPlace,
        has_laucher: !!hasDecentralandLauncher,
      })
    },
    [world, track]
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
      className={TokenList.join(["world-description", loading && "loading"])}
    >
      <div className="world-description__top-container">
        <div
          className="world-description__cover"
          style={
            !loading && world?.image
              ? {
                  backgroundImage: `url(${getImageUrl(world.image)})`,
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
                likeRate={world?.like_rate ?? null}
                likesCount={(world?.likes || 0) + (world?.dislikes || 0)}
                handlers={{
                  like: {
                    onClick: onClickLike,
                    active: world?.user_like,
                    loading: loadingLike,
                  },
                  dislike: {
                    onClick: onClickDislike,
                    active: world?.user_dislike,
                    loading: loadingDislike,
                  },
                }}
              />
            )}
            <JumpInPositionButton loading={loading} onClick={handleClick} />
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
      <DownloadModal
        open={showModal}
        title={l("components.modal.download.title")}
        description={l("components.modal.download.description")}
        buttonLabel={l("components.modal.download.button_label")}
        onClose={() => setShowModal(false)}
        onDownloadClick={handleModalClick}
      />
    </div>
  )
})
