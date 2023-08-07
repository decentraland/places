import React from "react"

import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Button } from "decentraland-ui/dist/components/Button/Button"

import { ThumbDown } from "../Icon/ThumbDown"

import "./LikeButtonBox.css"

export type LikeBoxProps = {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  loading?: boolean
  active?: boolean
}

export default React.memo(function LikeBox(props: LikeBoxProps) {
  const { onClick, loading, active } = props
  return (
    <Button
      onClick={onClick}
      className={TokenList.join([
        "like-button-box",
        active && "button-box__active",
      ])}
      target="_blank"
      loading={loading}
      disabled={loading}
    >
      <ThumbDown active={!!active} />
    </Button>
  )
})
