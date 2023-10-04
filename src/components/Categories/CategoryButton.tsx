import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import {
  Button,
  ButtonProps,
} from "decentraland-ui/dist/components/Button/Button"

import "./CategoryButton.css"

type CategoryButtonProps = ButtonProps & {
  onClick: () => void
  category: string
}

export const CategoryButton = ({ category, onClick }: CategoryButtonProps) => {
  const l = useFormatMessage()

  return (
    <Button
      className="category-btn"
      content={l(`categories.${category}`)}
      onClick={onClick}
    />
  )
}
