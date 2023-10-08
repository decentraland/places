import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Link } from "decentraland-gatsby/dist/plugins/intl"
import Label from "semantic-ui-react/dist/commonjs/elements/Label"

import { PlaceListOrderBy } from "../../entities/Place/types"
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
            as={Link}
            key={category}
            category={category}
            href={locations.places({
              category_ids: [category],
              order_by: PlaceListOrderBy.LIKE_SCORE_BEST,
            })}
          />
        ))}
      </div>
    </div>
  )
}
