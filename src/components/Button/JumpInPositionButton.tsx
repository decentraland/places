import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import {
  Button,
  ButtonProps,
} from "decentraland-ui/dist/components/Button/Button"

import primaryJumpInIcon from "../../images/primary-jump-in.svg"

import "./JumpInPositionButton.css"

export default React.memo(function JumpInPositionButton(props: ButtonProps) {
  const { loading, dataPlace } = props
  const l = useFormatMessage()

  return (
    <Button
      {...props}
      primary
      as="a"
      size="small"
      className="jump-in-position"
      target="_blank"
      disabled={loading}
      data-place={dataPlace}
    >
      <span>{l("components.button.jump_in")}</span>
      <img
        src={primaryJumpInIcon}
        width={14}
        height={14}
        className="icon left"
      />
    </Button>
  )
})
