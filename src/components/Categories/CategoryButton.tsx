import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import {
  Button,
  ButtonProps,
} from "decentraland-ui/dist/components/Button/Button"

import "./CategoryButton.css"

type CategoryButtonProps = ButtonProps & {
  onClick?: () => void
  rounded?: boolean
  active?: boolean
  disabled?: boolean
  category: string
}

export const CategoryButton = ({
  category,
  rounded,
  active,
  disabled,
  ...rest
}: CategoryButtonProps) => {
  const l = useFormatMessage()

  return (
    <Button
      className={`category-btn ${rounded ? "category-btn--rounded" : ""} ${
        active
          ? "category-btn--active"
          : disabled
          ? "category-btn--disabled"
          : ""
      }`}
      content={l(`categories.${category}`)}
      {...rest}
    />
  )
}
