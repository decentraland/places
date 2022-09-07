import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import Icon from "semantic-ui-react/dist/commonjs/elements/Icon"
import Label from "semantic-ui-react/dist/commonjs/elements/Label"

import "./ButtonBox.css"

export type FavoriteBoxProps = {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  loading?: boolean
  active?: boolean
}

export default React.memo(function FavoriteBox(props: FavoriteBoxProps) {
  const l = useFormatMessage()
  return (
    <Button
      secondary
      onClick={props.onClick}
      className="button-box icon"
      target="_blank"
      loading={props.loading}
      disabled={props.loading}
    >
      <Icon
        name="heart outline"
        className={
          props.active ? "button-box__icon" : "button-box__icon-hovered"
        }
      />

      <Icon
        name="heart"
        className={
          !props.active ? "button-box__icon" : "button-box__icon-hovered"
        }
      />
      <Label>{l("components.button.favorite")}</Label>
    </Button>
  )
})
