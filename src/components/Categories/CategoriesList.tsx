import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import Label from "semantic-ui-react/dist/commonjs/elements/Label"

import { CategoryFilter } from "./CategoryFilter"

import "./CategoriesList.css"

type CategoriesListProps = {
  onSelect: (id: string) => void
  categories: { categoryId: string; active: boolean }[]
}

export const CategoriesList = ({
  categories,
  onSelect,
}: CategoriesListProps) => {
  const l = useFormatMessage()

  return (
    <div className="categories-list__box">
      <div className="categories-list__title">
        <p>{l("categories.title")}</p>
        <Label>{l("categories.new_label")}</Label>
      </div>
      <div className="categories-list__listing">
        {categories.map(({ categoryId, active }) => (
          <CategoryFilter
            category={categoryId}
            onAddFilter={() => onSelect(categoryId)}
            active={active}
            useCheck
          />
        ))}
      </div>
    </div>
  )
}
