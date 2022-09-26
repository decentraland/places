import React from "react"

import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import Icon from "semantic-ui-react/dist/commonjs/elements/Icon"

import "./FavoriteButton.css"

export type FavoriteButtonProps = {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  active?: boolean
  loading?: boolean
}

export default React.memo(function FavoriteButton(props: FavoriteButtonProps) {
  const { onClick, loading, active } = props
  return (
    <Button
      primary
      onClick={onClick}
      className={TokenList.join(["heart-button", "icon", active && "active"])}
      loading={loading}
      disabled={loading}
    >
      {!loading && <Icon name="heart outline" className="heart-button__icon" />}
      {!loading && <Icon name="heart" className="heart-button__icon--active" />}
    </Button>
  )
})
