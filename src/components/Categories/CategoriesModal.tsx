import React, { useEffect, useState } from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Button } from "decentraland-ui/dist/components/Button/Button"

import { CategoryFilter } from "./CategoryFilter"

import "./CategoriesModal.css"

type CategoriesModalProps = {
  categories: { categoryId: string; active: boolean }[]
  onClose: () => void
  onClearAll: () => void
  onApplySelection: (categoryIds: string[]) => void
}

export const CategoriesModal = ({
  categories,
  onClearAll,
  onClose,
  onApplySelection,
}: CategoriesModalProps) => {
  const l = useFormatMessage()

  const [selectedCategories, setSelectedCategories] = useState(() => {
    return categories
      .filter(({ active }) => active)
      .map(({ categoryId }) => categoryId)
  })

  useEffect(() => {
    console.log("rendering due to categories")
    console.log(selectedCategories)
  }, [categories])

  return (
    <div className="categories-modal__layer">
      <div className="categories-modal__box">
        <div className="categories-modal__header">
          <Button
            basic
            content="Clear All"
            onClick={() => onClearAll()}
            disabled={!!categories.length}
          />
          <p>
            {selectedCategories.length
              ? `${selectedCategories.length} ${l(
                  "categories.modal.category_selected"
                )}`
              : l("categories.modal.one_or_more")}
          </p>
          <Button
            basic
            content="Close"
            onClick={() => {
              onClose()
            }}
          />
        </div>
        <div className="categories-modal__content">
          {categories.map(({ categoryId }) => (
            <CategoryFilter
              key={categoryId}
              category={categoryId}
              active={selectedCategories.includes(categoryId)}
              onAddFilter={() => {
                if (!selectedCategories.includes(categoryId)) {
                  setSelectedCategories([...selectedCategories, categoryId])
                }
              }}
              onRemoveFilter={() => {
                setSelectedCategories((selected) =>
                  selected.filter((c) => c != categoryId)
                )
              }}
              useCheck
            />
          ))}
        </div>
        <div className="categories-modal__footer">
          <Button
            primary
            size="medium"
            content="Apply Selection"
            onClick={() => onApplySelection([])}
          />
        </div>
      </div>
    </div>
  )
}
