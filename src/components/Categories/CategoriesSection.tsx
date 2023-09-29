import React from "react"

import Label from "semantic-ui-react/dist/commonjs/elements/Label"

import { CategoryButton } from "./CategoryButton"

import "./CategoriesSection.css"

type CategoriesProps = {
  categories: string[]
}

export const CategoriesSection = ({ categories }: CategoriesProps) => {
  return (
    <div className="categories-section__box">
      <div className="categories-section__title">
        <p>Explore Categories</p>
        <Label>NEW</Label>
      </div>
      <div className="categories-section__slider">
        {categories.map((category) => (
          <CategoryButton category={category} />
        ))}
      </div>
    </div>
  )
}
