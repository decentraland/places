import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"

import { CategoryButtons } from "../Button/CategoryButtons"
import { NewLabel } from "../Label/NewLabel/NewLabel"

import "./CategorySections.css"

type CategorySectionsProps = {
  categories: string[]
}

export const CategorySections = (props: CategorySectionsProps) => {
  const { categories } = props
  const l = useFormatMessage()

  return (
    <div className="category-sections__box">
      <NewLabel
        title={l("categories.explore")}
        className="category-sections__title"
      />
      <CategoryButtons categories={categories} />
    </div>
  )
}
