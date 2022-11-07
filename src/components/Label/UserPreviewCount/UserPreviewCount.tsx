import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import Label, {
  LabelProps,
} from "semantic-ui-react/dist/commonjs/elements/Label"

import { Preview } from "../../Icon/Preview"

import "./UserPreviewCount.css"

export type UserPreviewCountProps = LabelProps & {
  value?: number
  loading?: boolean
}

export default React.memo(function UserPreviewCount(
  props: UserPreviewCountProps
) {
  const l = useFormatMessage()
  const { loading, className, value } = props
  return (
    <Label
      className={TokenList.join([
        "user-preview",
        className,
        !value && "hidden",
      ])}
    >
      <Preview nohover active />
      {!loading && l("general.visits", { value })}
    </Label>
  )
})
