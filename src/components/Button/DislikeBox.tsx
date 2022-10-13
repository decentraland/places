import React from "react"

import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import Label from "semantic-ui-react/dist/commonjs/elements/Label"

import shorterNumber from "../../utils/number/sortenNumber"
import { ThumbDown } from "../Icon/ThumbDown"

import "./ButtonBox.css"

export type DislikeBoxProps = {
  total: number
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  loading?: boolean
  active?: boolean
}

export default React.memo(function DislikeBox(props: DislikeBoxProps) {
  const { onClick, loading, active, total } = props
  return (
    <Button
      onClick={onClick}
      className={TokenList.join(["button-box", active && "button-box__active"])}
      target="_blank"
      loading={loading}
      disabled={loading}
    >
      <ThumbDown active={!!active} />
      <Label>{shorterNumber(total)}</Label>
    </Button>
  )
})
