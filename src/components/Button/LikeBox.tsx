import React from "react"

import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import Label from "semantic-ui-react/dist/commonjs/elements/Label"

import shorterNumber from "../../utils/number/sortenNumber"
import { ThumbUp } from "../Icon/ThumbUp"

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
      className={TokenList.join(["button-box", active && "button-box__active"])}
      target="_blank"
      loading={loading}
      disabled={loading}
    >
      <ThumbUp active={!!active} />
      <Label>{shorterNumber(total)}</Label>
    </Button>
  )
})
