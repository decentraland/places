import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import Popup from "semantic-ui-react/dist/commonjs/modules/Popup"

import { toPercent } from "../../modules/number"
import LikeBox from "../Button/LikeBox"
import { ThumbUpFilled } from "../Icon/ThumbUp"

import "./Likes.css"

type LikesProps = {
  likeRate: number
  likesCount: number
  handlers: {
    like: {
      fn: (e: React.MouseEvent<HTMLButtonElement>) => void
      active?: boolean
      loading?: boolean
    }
    dislike: {
      fn: (e: React.MouseEvent<HTMLButtonElement>) => void
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
        <p style={{ color: "#161418", marginLeft: "5px" }}>
          {toPercent(likeRate)}%{" "}
          <span style={{ color: "#726d7c" }}>({likesCount})</span>
        </p>
        <InfoButton />
      </div>
      <div className="likes-button-container">
        <LikeBox
          thumb="up"
          onClick={handlers.like.fn}
          active={handlers.like.active}
          loading={handlers.like.loading}
        />
        <LikeBox
          thumb="down"
          onClick={handlers.dislike.fn}
          active={handlers.dislike.active}
          loading={handlers.dislike.loading}
        />
      </div>
    </div>
  )
}

const InfoButton = () => {
  const l = useFormatMessage()
  return (
    <Popup
      content={l("components.place_description.like_percentage_explanation")}
      position="top center"
      trigger={<div className="info-logo" />}
      style={{
        backgroundColor: "#716B7C",
        height: "69px",
        width: "181px",
        padding: "12px 13px",
        border: "2px none",
        fontSize: "12px",
      }}
      on="hover"
    />
  )
}
