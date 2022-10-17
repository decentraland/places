import React from "react"

import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import Label, {
  LabelProps,
} from "semantic-ui-react/dist/commonjs/elements/Label"

import { ThumbUp } from "../../Icon/ThumbUp"

import "./UserLikePercentage.css"

export type UserLikePercentageProps = LabelProps & {
  total: number
  loading?: boolean
}

export default React.memo(function UserLikePercentage(
  props: UserLikePercentageProps
) {
  const { loading, className, total } = props
  return (
    <Label className={TokenList.join(["user-count", className])}>
      <ThumbUp noHover active />
      {!loading && `${total}%`}
    </Label>
  )
})
