import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Filter } from "decentraland-ui/dist/components/Filter/Filter"

import { Category } from "../../entities/Category/types"
import { Close } from "../Icon/Close"
import { Trash } from "../Icon/Trash"
import { CategoryFilterProps } from "./CategoryFilter"
import { CategoryFilters } from "./CategoryFilters"

import "./SelectedCategoriesNavbar.css"

type SelectedCategoriesNavbarProps = {
  categories: Category[]
  onChangeFilters: (
    e: React.MouseEvent<HTMLSpanElement, MouseEvent>,
    props: CategoryFilterProps
  ) => void
  onClickClearAll: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void
}

const SelectedCategoriesNavbar = ({
  categories,
  onChangeFilters,
  onClickClearAll,
}: SelectedCategoriesNavbarProps) => {
  const l = useFormatMessage()

  return (
    <div className="category-filters-box">
      <CategoryFilters
        categories={categories}
        onlyActives
        onChange={onChangeFilters}
        filtersIcon={<Close width="20" height="20" />}
      />
      <span className="clear-all-filter-btn" onClick={onClickClearAll}>
        <Filter>
          <Trash width="20" height="20" /> <p>{l("pages.places.clear_all")}</p>
        </Filter>
      </span>
    </div>
  )
}

export default SelectedCategoriesNavbar
