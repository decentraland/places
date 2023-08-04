import React from "react"

import { toPercent } from "../../modules/number"
import DislikeBox from "../Button/DislikeBox"
import LikeBox from "../Button/LikeBox"
import { Info } from "../Icon/Info"
import { ThumbUpFilled } from "../Icon/ThumbUp"

import "./Likes.css"

type LikesProps = {
  likeRate: number
  likesCount: number
  handlers: {
    like: {
      onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
      active?: boolean
      loading?: boolean
    }
    dislike: {
      onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
      active?: boolean
      loading?: boolean
    }
  }
}

export const Likes: React.FunctionComponent<LikesProps> = ({
  likeRate,
  likesCount,
  handlers,
}) => {
  return (
    <div className="likes-container-wrapper">
      <div className="likes-info-container">
        <div>
          <ThumbUpFilled />
        </div>
        <p>
          {toPercent(likeRate)}% <span>({likesCount})</span>
        </p>
        <Info />
      </div>
      <div className="likes-button-container">
        <LikeBox
          onClick={handlers.like.onClick}
          active={handlers.like.active}
          loading={handlers.like.loading}
        />
        <DislikeBox
          onClick={handlers.dislike.onClick}
          active={handlers.dislike.active}
          loading={handlers.dislike.loading}
        />
      </div>
    </div>
  )
}
