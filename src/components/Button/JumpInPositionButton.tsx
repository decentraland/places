import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Button } from "decentraland-ui/dist/components/Button/Button"

import primaryJumpInIcon from "../../images/primary-jump-in.svg"

import "./JumpInPositionButton.css"

export type JumpInPositionButtonProps = {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  href?: string
  loading?: boolean
}

export default React.memo(function JumpInPositionButton(
  props: JumpInPositionButtonProps
) {
  const { href, loading, onClick } = props
  const l = useFormatMessage()

  return (
    <Button
      primary
      as="a"
      size="small"
      onClick={onClick}
      className="jump-in-position"
      href={href}
      target="_blank"
      loading={loading}
      disabled={loading}
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
