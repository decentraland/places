import React from "react"

import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import Label, {
  LabelProps,
} from "semantic-ui-react/dist/commonjs/elements/Label"

import { Players } from "../../Icon/Players"

import "./UserCount.css"

export type UserCountProps = LabelProps & {
  total: number
  loading?: boolean
}

export default React.memo(function UserCount(props: UserCountProps) {
  const { loading, className, total } = props
  return (
    <Label className={TokenList.join(["user-count", className])}>
      <Players emptyStroke noHover />
      {!loading && total}
    </Label>
  )
})
