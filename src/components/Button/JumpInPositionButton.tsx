import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Button } from "decentraland-ui/dist/components/Button/Button"

import primaryJumpInIcon from "../../images/primary-jump-in.svg"

import "./JumpInPositionButton.css"

export type JumpInPositionButtonProps = {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  href: string
  loading?: boolean
}

export default React.memo(function JumpInPositionButton(
  props: JumpInPositionButtonProps
) {
  const l = useFormatMessage()

  return (
    <Button
      primary
      as="a"
      size="small"
      onClick={props.onClick}
      className="jump-in-position"
      href={props.href}
      target="_blank"
      loading={props.loading}
      disabled={props.loading}
    >
      <span>{l("components.button.jump_in")}</span>
      {!props.loading && (
        <img
          src={primaryJumpInIcon}
          width={14}
          height={14}
          className="icon left"
        />
      )}
    </Button>
  )
})
