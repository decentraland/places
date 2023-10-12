import React from "react"

import { CategoryFilter } from "./CategoryFilter"
import { Categories } from "./types"

type CategoriesFiltersProps = {
  categories: Categories
  onChange: (newCategories: Categories) => void
  onlyActives?: boolean
  filtersIcon?: React.ReactNode
  unremovableFilters?: boolean
  className?: string
}

export const CategoriesFilters = ({
  categories,
  onChange,
  filtersIcon,
  onlyActives,
  unremovableFilters,
  className,
}: CategoriesFiltersProps) => {
  function handleCategorySelection(
    action: "add" | "remove",
    categoryId: string
  ): Categories {
    let currentCategories = categories.filter(({ active }) => active)
    if (action === "add") {
      if (!currentCategories.find(({ name }) => name === categoryId)) {
        const category = {
          ...categories.find(({ name }) => name === categoryId)!,
        }
        category.active = true
        currentCategories.push(category)
      }
    }

    if (action === "remove") {
      currentCategories = currentCategories.filter(
        ({ name }) => name !== categoryId
      )
    }

    return currentCategories
  }

  return (
    <div className={className}>
      {categories
        .filter(({ active }) => {
          if (onlyActives) {
            return active
          } else {
            return true
          }
        })
        .map((category) => (
          <CategoryFilter
            key={category.name}
            category={category.name}
            active={category.active}
            onChange={(_e, { active, category }) => {
              const newOnes = handleCategorySelection(
                active ? "add" : !unremovableFilters ? "remove" : "add",
                category
              )
              if (
                categories.filter(({ active }) => active).length !=
                newOnes.length
              ) {
                onChange(newOnes)
              }
            }}
            actionIcon={filtersIcon}
          />
        ))}
    </div>
  )
}
