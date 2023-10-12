import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import Label from "semantic-ui-react/dist/commonjs/elements/Label"

export type NewLabelProps = {
  title: string
  className?: string
}

export const NewLabel = ({ title }: NewLabelProps) => {
  const l = useFormatMessage()

  return (
    <div>
      <p>{title}</p>
      <Label>{l("categories.new_label")}</Label>
    </div>
  )
}
