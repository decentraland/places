import React from "react"

import { CategoryFilter } from "./CategoryFilter"

type CategoriesFiltersProps = {
  categories: { name: string; active: boolean; count: number }[]
  onChange: (
    newCategories: { name: string; active: boolean; count: number }[]
  ) => void
  onlyActives?: boolean
  filtersIcon?: JSX.Element
  unremovableFilters?: boolean
}

export const CategoriesFilters = ({
  categories,
  onChange,
  filtersIcon,
  onlyActives,
  unremovableFilters,
}: CategoriesFiltersProps) => {
  function handleCategorySelection(
    action: "add" | "remove",
    categoryId: string
  ): { name: string; active: boolean; count: number }[] {
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
    <>
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
    </>
  )
}
