import React, { useCallback } from "react"

import useTrackContext from "decentraland-gatsby/dist/context/Track/useTrackContext"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import Icon from "semantic-ui-react/dist/commonjs/elements/Icon"

import { AggregatePlaceAttributes } from "../../entities/Place/types"

import "./PlaceFavoriteButton.css"

export type PlaceFavoriteButtonProps = {
  place: AggregatePlaceAttributes
  onClick?: (
    e: React.MouseEvent<MouseEvent>,
    place: AggregatePlaceAttributes
  ) => void
}

export default function PlaceFavoriteButton({
  place,
  ...props
}: PlaceFavoriteButtonProps) {
  const track = useTrackContext()

  const handleClick = useCallback(
    (e: React.MouseEvent<any>) => {
      e.stopPropagation()
      if (props.onClick) {
        props.onClick(e, place)
      }
      // TODO tracking
    },
    [place, track]
  )

  return (
    <Button
      primary
      onClick={handleClick}
      className="heart-button"
      target="_blank"
    >
      <Icon name="heart outline" className="heart-button__icon" />
      <Icon name="heart" className="heart-button__icon-hovered" />
    </Button>
  )
}
