import React from "react"

import { Back } from "decentraland-ui/dist/components/Back/Back"

import { CategoryFilter, CategoryFilterProps } from "./CategoryFilter"
import { Close } from "../Icon/Close"

import "./OnlyViewCategoryNavbar.css"

type OnlyViewCategoryNavbarPros = {
  category: string
  onClickBack: (e: React.MouseEvent<Element, MouseEvent>) => void
  onClickCategoryFilter: (
    e: React.MouseEvent<HTMLSpanElement, MouseEvent>,
    props: CategoryFilterProps
  ) => void
}

const OnlyViewCategoryNavbar = ({
  category,
  onClickBack,
  onClickCategoryFilter,
}: OnlyViewCategoryNavbarPros) => {
  return (
    <div className="only-view-category-navbar__box">
      <Back onClick={onClickBack} />
      <div>
        <CategoryFilter
          category={category}
          active
          onChange={onClickCategoryFilter}
          actionIcon={<Close width="20" height="20" />}
        />
      </div>
    </div>
  )
}

export default OnlyViewCategoryNavbar
