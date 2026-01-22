import React from "react"

import { CategoryFilter, CategoryFilterProps } from "./CategoryFilter"
import { Category } from "../../entities/Category/types"

type CategoryFiltersProps = {
  categories: Category[]
  onChange: (
    e: React.MouseEvent<HTMLSpanElement, MouseEvent>,
    props: CategoryFilterProps
  ) => void
  onlyActives?: boolean
  filtersIcon?: React.ReactNode
  unremovableFilters?: boolean
  className?: string
}

export const CategoryFilters = (props: CategoryFiltersProps) => {
  const {
    categories,
    onChange,
    filtersIcon,
    onlyActives,
    // TODO: review a way to do this or if this is needed (@lauti7)
    // unremovableFilters,
    className,
  } = props

  return (
    <div className={className}>
      {categories
        .filter(({ active }) => (onlyActives ? active : true))
        .sort((a, b) => (a.name === b.name ? 0 : a.name < b.name ? -1 : 1))
        .map((category) => (
          <CategoryFilter
            key={category.name}
            category={category.name}
            active={category.active}
            onChange={onChange}
            actionIcon={filtersIcon}
          />
        ))}
    </div>
  )
}
