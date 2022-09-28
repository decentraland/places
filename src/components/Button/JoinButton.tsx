import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import {
  Button,
  ButtonProps,
} from "decentraland-ui/dist/components/Button/Button"

import primaryJumpInIcon from "../../images/primary-jump-in.svg"

import "./JoinButton.css"

export default React.memo(function JoinButton(props: ButtonProps) {
  const { loading } = props
  const l = useFormatMessage()

  return (
    <Button
      {...props}
      primary
      as="a"
      size="small"
      className="join"
      target="_blank"
      disabled={loading}
    >
      <span>{l("components.button.join")}</span>
      <img
        src={primaryJumpInIcon}
        width={14}
        height={14}
        className="icon left"
      />
    </Button>
  )
})
