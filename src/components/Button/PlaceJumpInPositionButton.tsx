import React, { useCallback } from "react"

import useTrackContext from "decentraland-gatsby/dist/context/Track/useTrackContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Button } from "decentraland-ui/dist/components/Button/Button"

import { AggregatePlaceAttributes } from "../../entities/Place/types"
import { placeTargetUrl } from "../../entities/Place/utils"
import primaryJumpInIcon from "../../images/primary-jump-in.svg"

import "./PlaceJumpInPositionButton.css"

export type PlaceJumpInPositionButtonProps = {
  place: AggregatePlaceAttributes
  onClick?: (
    e: React.MouseEvent<MouseEvent>,
    place: AggregatePlaceAttributes
  ) => void
}

export default function PlaceJumpInPositionButton({
  place,
  ...props
}: PlaceJumpInPositionButtonProps) {
  const l = useFormatMessage()
  const track = useTrackContext()
  const to = placeTargetUrl(place)

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
      size="small"
      onClick={handleClick}
      className="jump-in-position"
      href={to}
      target="_blank"
    >
      <span>{l("components.button.jump_in")}</span>
      <img
        src={primaryJumpInIcon}
        width={14}
        height={14}
        style={{ marginLeft: ".5rem" }}
      />
    </Button>
  )
}
