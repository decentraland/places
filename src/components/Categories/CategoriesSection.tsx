import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { navigate } from "decentraland-gatsby/dist/plugins/intl"
import Label from "semantic-ui-react/dist/commonjs/elements/Label"

import locations from "../../modules/locations"
import { CategoryButton } from "./CategoryButton"

import "./CategoriesSection.css"

type CategoriesProps = {
  categories: string[]
}

export const CategoriesSection = ({ categories }: CategoriesProps) => {
  const l = useFormatMessage()

  return (
    <div className="categories-section__box">
      <div className="categories-section__title">
        <p>{l("categories.explore")}</p>
        <Label>{l("categories.new_label")}</Label>
      </div>
      <div className="categories-section__slider">
        {categories.map((category) => (
          <CategoryButton
            category={category}
            onClick={() =>
              navigate(locations.places({ categories: [category] }))
            }
          />
        ))}
      </div>
    </div>
  )
}
