import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import Label from "semantic-ui-react/dist/commonjs/elements/Label"

import { Heart } from "../Icon/Heart"

import "./ButtonBox.css"

export type FavoriteBoxProps = {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  loading?: boolean
  active?: boolean
}

export default React.memo(function FavoriteBox(props: FavoriteBoxProps) {
  const { onClick, loading, active } = props
  const l = useFormatMessage()
  return (
    <Button
      secondary
      onClick={onClick}
      className={TokenList.join(["button-box", active && "button-box__active"])}
      target="_blank"
      loading={loading}
      disabled={loading}
    >
      <Heart active={!!active} />
      <Label>{l("components.button.favorite")}</Label>
    </Button>
  )
})
