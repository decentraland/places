import React from "react"

import { CategoryFilter } from "./CategoryFilter"

type CategoriesFiltersProps = {
  categories: { name: string; active: boolean; count: number }[]
  onChange: (
    newCategories: { name: string; active: boolean; count: number }[]
  ) => void
  onlyActives?: boolean
  filtersIcon?: JSX.Element
}

export const CategoriesFilters = ({
  categories,
  onChange,
  filtersIcon,
  onlyActives,
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
                active ? "add" : "remove",
                category
              )
              onChange(newOnes)
            }}
            actionIcon={filtersIcon}
          />
        ))}
    </>
  )
}
