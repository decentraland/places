import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Link } from "decentraland-gatsby/dist/plugins/intl"

import { PlaceListOrderBy } from "../../entities/Place/types"
import locations from "../../modules/locations"
import { CategoryButton } from "./CategoryButton"
import { NewLabel } from "./NewLabel"

import "./CategoriesSection.css"

type CategoriesProps = {
  categories: string[]
}

export const CategoriesSection = ({ categories }: CategoriesProps) => {
  const l = useFormatMessage()

  return (
    <div className="categories-section__box">
      <NewLabel
        title={l("categories.explorre")}
        className="categories-section__title"
      />
      <div className="categories-section__slider">
        {categories.map((category) => (
          <CategoryButton
            as={Link}
            key={category}
            category={category}
            href={locations.places({
              categories: [category],
              order_by: PlaceListOrderBy.LIKE_SCORE_BEST,
            })}
          />
        ))}
      </div>
    </div>
  )
}
