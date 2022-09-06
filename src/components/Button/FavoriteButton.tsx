import React from "react"

import { Button } from "decentraland-ui/dist/components/Button/Button"
import Icon from "semantic-ui-react/dist/commonjs/elements/Icon"

import "./FavoriteButton.css"

export type FavoriteButtonProps = {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  loading?: boolean
}

export default React.memo(function FavoriteButton(props: FavoriteButtonProps) {
  return (
    <Button
      primary
      onClick={props.onClick}
      className="heart-button icon"
      target="_blank"
      loading={props.loading}
      disabled={props.loading}
    >
      {!props.loading && (
        <Icon name="heart outline" className="heart-button__icon" />
      )}
      {!props.loading && (
        <Icon name="heart" className="heart-button__icon-hovered" />
      )}
    </Button>
  )
})
