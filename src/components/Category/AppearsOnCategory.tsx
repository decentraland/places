import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"

import { CategoryFilter, CategoryFilterProps } from "./CategoryFilter"

import "./AppearsOnCategory.css"

type AppearsOnCategoryProps = {
  categories: string[]
  onSelectCategory: (
    e: React.MouseEvent<HTMLSpanElement, MouseEvent>,
    props: CategoryFilterProps
  ) => void
}

const AppearsOnCategory = ({
  categories,
  onSelectCategory,
}: AppearsOnCategoryProps) => {
  const l = useFormatMessage()

  return (
    <div className="appears-on-categories-container">
      <h3>{l("components.place_detail.appears_on")}</h3>
      {categories.map((id) => (
        <CategoryFilter category={id} onChange={onSelectCategory} />
      ))}
    </div>
  )
}

export default AppearsOnCategory
