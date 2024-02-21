import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"

import { Category } from "../../entities/Category/types"
import { Check } from "../Icon/Check"
import { NewLabel } from "../Label/NewLabel/NewLabel"
import { CategoryFilterProps } from "./CategoryFilter"
import { CategoryFilters } from "./CategoryFilters"

import "./CategoryList.css"

type CategoryList = {
  onChange: (
    e: React.MouseEvent<HTMLSpanElement, MouseEvent>,
    props: CategoryFilterProps
  ) => void
  categories: Category[]
  label: string
  applyfilter?: boolean
  isNew?: boolean
}

export const CategoryList = React.memo((props: CategoryList) => {
  const { categories, onChange, isNew, label } = props
  const l = useFormatMessage()

  return (
    <div className="category-list__box">
      {isNew ? (
        <NewLabel
          title={`${label} ${l("categories.title")}`}
          className="category-list__title"
        />
      ) : (
        <div className="category-list__title">
          <p>
            {label} {l("categories.title")}
          </p>
        </div>
      )}
      <CategoryFilters
        categories={categories}
        onChange={onChange}
        filtersIcon={<Check />}
        unremovableFilters
        className="category-list__listing"
      />
    </div>
  )
})
