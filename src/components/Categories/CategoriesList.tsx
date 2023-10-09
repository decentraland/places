import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import Label from "semantic-ui-react/dist/commonjs/elements/Label"

import { Check } from "../Icon/Check"
import { CategoriesFilters } from "./CategoriesFilters"

import "./CategoriesList.css"

type CategoriesListProps = {
  onChange: (
    categories: { name: string; active: boolean; count: number }[]
  ) => void
  categories: { name: string; active: boolean; count: number }[]
}

export const CategoriesList = React.memo(
  ({ categories, onChange }: CategoriesListProps) => {
    const l = useFormatMessage()

    return (
      <div className="categories-list__box">
        <div className="categories-list__title">
          <p>{l("categories.title")}</p>
          <Label>{l("categories.new_label")}</Label>
        </div>
        <div className="categories-list__listing">
          {
            <CategoriesFilters
              categories={categories}
              onChange={onChange}
              filtersIcon={<Check />}
              unremovableFilters
            />
          }
        </div>
      </div>
    )
  }
)
