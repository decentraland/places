import React from "react"

import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import Label, {
  LabelProps,
} from "semantic-ui-react/dist/commonjs/elements/Label"

import { Players } from "../../Icon/Players"

import "./UserCount.css"

export type UserCountProps = LabelProps & {
  value: number
  loading?: boolean
}

export default React.memo(function UserCount(props: UserCountProps) {
  const { loading, className, value } = props
  return (
    <Label
      className={TokenList.join([
        "user-count",
        className,
        value === 0 && "hidden",
      ])}
    >
      <Players nohover active />
      {!loading && value}
    </Label>
  )
})
