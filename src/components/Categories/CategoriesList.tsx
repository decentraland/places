import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"

import { Check } from "../Icon/Check"
import { CategoriesFilters } from "./CategoriesFilters"
import { NewLabel } from "./NewLabel"
import { Categories } from "./types"

import "./CategoriesList.css"

type CategoriesListProps = {
  onChange: (categories: Categories) => void
  categories: Categories
}

export const CategoriesList = React.memo(
  ({ categories, onChange }: CategoriesListProps) => {
    const l = useFormatMessage()

    return (
      <div className="categories-list__box">
        <NewLabel
          title={l("categories.title")}
          className="categories-list__title"
        />
        <CategoriesFilters
          categories={categories}
          onChange={onChange}
          filtersIcon={<Check />}
          unremovableFilters
          className="categories-list__listing"
        />
      </div>
    )
  }
)
