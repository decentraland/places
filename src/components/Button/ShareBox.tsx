import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import Label from "semantic-ui-react/dist/commonjs/elements/Label"

import { Share } from "../Icon/Share"

import "./ButtonBox.css"

export type ShareBoxProps = {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  loading?: boolean
  active?: boolean
}

export default React.memo(function ShareBox(props: ShareBoxProps) {
  const { onClick, loading, active } = props
  const l = useFormatMessage()

  return (
    <Button
      secondary
      onClick={onClick}
      className={TokenList.join(["button-box", active && "button-box__active"])}
      target="_blank"
      loading={loading}
    >
      <Share />
      <Label>{l("components.button.share")}</Label>
    </Button>
  )
})
