import React from "react"

import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
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
        className={TokenList.join([
          "button-box__icon",
          !active && "button-box__icon--active",
        ])}
      />

      <Icon
        name="thumbs up"
        className={TokenList.join([
          "button-box__icon",
          active && "button-box__icon--active",
        ])}
      />
      <Label>{shorterNumber(total)}</Label>
    </Button>
  )
})
