import React from "react"

import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Button } from "decentraland-ui/dist/components/Button/Button"

import { Heart } from "../Icon/Heart"

import "./FavoriteButton.css"

export type FavoriteButtonProps = {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  active?: boolean
  loading?: boolean
  dataPlace?: string
}

export default React.memo(function FavoriteButton(props: FavoriteButtonProps) {
  const { onClick, loading, active, dataPlace } = props
  return (
    <Button
      primary
      onClick={onClick}
      className={TokenList.join([
        "heart-button",
        active && "heart-button__active",
      ])}
      loading={loading}
      disabled={loading}
      data-place={dataPlace}
    >
      <Heart active={!!active} />
    </Button>
  )
})
