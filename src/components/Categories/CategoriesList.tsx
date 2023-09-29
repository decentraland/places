import React from "react"

import Label from "semantic-ui-react/dist/commonjs/elements/Label"

import { CategoryButton } from "./CategoryButton"

import "./CategoriesList.css"

type CategoriesListProps = {
  onSelect: (id: string) => void
  categories: string[]
}

export const CategoriesList = ({
  categories,
  onSelect,
}: CategoriesListProps) => {
  return (
    <div className="categories-list__box">
      <div className="categories-list__title">
        <p>Categories</p>
        <Label>NEW</Label>
      </div>
      <div className="categories-list__listing">
        {categories.map((category) => (
          <CategoryButton
            category={category}
            onClick={() => onSelect(category)}
            rounded
          />
        ))}
      </div>
    </div>
  )
}
