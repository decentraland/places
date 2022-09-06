import React from "react"

import { Button } from "decentraland-ui/dist/components/Button/Button"
import Icon from "semantic-ui-react/dist/commonjs/elements/Icon"
import Label from "semantic-ui-react/dist/commonjs/elements/Label"

import shorterNumber from "../../utils/number/sortenNumber"

import "./ButtonBox.css"

export type LikeBoxProps = {
  total: number
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  loading?: boolean
  active?: boolean
}

export default React.memo(function LikeBox(props: LikeBoxProps) {
  const { onClick, loading, active, total } = props
  return (
    <Button
      secondary
      onClick={onClick}
      className="button-box icon"
      target="_blank"
      loading={loading}
      disabled={loading}
    >
      <Icon
        name="thumbs up outline"
        className={active ? "button-box__icon" : "button-box__icon-hovered"}
      />

      <Icon
        name="thumbs up"
        className={!active ? "button-box__icon" : "button-box__icon-hovered"}
      />
      <Label>{shorterNumber(total)}</Label>
    </Button>
  )
})
