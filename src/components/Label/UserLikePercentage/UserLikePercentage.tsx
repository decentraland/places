import React from "react"

import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import Label, {
  LabelProps,
} from "semantic-ui-react/dist/commonjs/elements/Label"

import { toPercent } from "../../../modules/number"
import { ThumbUp } from "../../Icon/ThumbUp"

import "./UserLikePercentage.css"

export type UserLikePercentageProps = LabelProps & {
  value: number
  loading?: boolean
}

export default React.memo(function UserLikePercentage(
  props: UserLikePercentageProps
) {
  const { loading, className, value } = props

  return (
    <Label
      className={TokenList.join([
        "user-like",
        className,
        value === 0 && "hidden",
      ])}
    >
      <ThumbUp nohover active />
      {!loading && `${toPercent(value)}%`}
    </Label>
  )
})
