import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import Label from "semantic-ui-react/dist/commonjs/elements/Label"

export type NewLabelProps = {
  title: string
  className?: string
}

export const NewLabel = React.memo(({ title, className }: NewLabelProps) => {
  const l = useFormatMessage()

  return (
    <div className={className}>
      <p>{title}</p>
      <Label>{l("categories.new_label")}</Label>
    </div>
  )
})
