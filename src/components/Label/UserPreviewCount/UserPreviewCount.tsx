import React from "react"

import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import Label, {
  LabelProps,
} from "semantic-ui-react/dist/commonjs/elements/Label"

import { Preview } from "../../Icon/Preview"

import "./UserPreviewCount.css"

export type UserPreviewCountProps = LabelProps & {
  value?: string
  loading?: boolean
}

export default React.memo(function UserPreviewCount(
  props: UserPreviewCountProps
) {
  const { loading, className, value } = props
  return (
    <Label
      className={TokenList.join([
        "user-preview",
        className,
        !value && "hidden",
      ])}
    >
      <Preview noHover active />
      {!loading && value}
    </Label>
  )
})
