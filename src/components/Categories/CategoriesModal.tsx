import React, { useCallback, useEffect, useState } from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import { Modal, ModalProps } from "decentraland-ui/dist/components/Modal/Modal"

import { Check } from "../Icon/Check"
import { Close } from "../Icon/Close"
import { CategoriesFilters } from "./CategoriesFilters"

import "./CategoriesModal.css"

type CategoriesModalProps = ModalProps & {
  categories: { name: string; active: boolean; count: number }[]
  onClose: () => void
  onClearAll: () => void
  onApplySelection: (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    names: string[]
  ) => void
}

export const CategoriesModal = React.memo(
  ({
    categories,
    onClearAll,
    onClose,
    onApplySelection,
    ...rest
  }: CategoriesModalProps) => {
    const l = useFormatMessage()

    const [selectedCategories, setSelectedCategories] = useState(() => {
      return new Set(
        categories.filter(({ active }) => active).map(({ name }) => name)
      )
    })

    useEffect(() => {
      setSelectedCategories(() => {
        return new Set(
          categories.filter(({ active }) => active).map(({ name }) => name)
        )
      })
    }, [categories])

    const onFilterChange = useCallback(
      (categories: { active: boolean; name: string }[]) => {
        const newSet = new Set(selectedCategories)
        for (const category of categories) {
          if (category.active) {
            newSet.add(category.name)
          } else {
            newSet.delete(category.name)
          }
        }
        setSelectedCategories(newSet)
      },
      []
    )

    return (
      <Modal {...rest} className="categories-modal__box">
        <Modal.Header className="categories-modal__header">
          <Button
            basic
            content="Clear All"
            onClick={onClearAll}
            disabled={!!selectedCategories.size}
            className="clear-all"
          />
          <p
            className={
              selectedCategories.size ? "categories-modal__text--smaller" : ""
            }
          >
            {selectedCategories.size
              ? `${selectedCategories.size} ${l(
                  "categories.modal.category_selected"
                )}`
              : l("categories.modal.one_or_more")}
          </p>
          <Button
            className="close-btn"
            basic
            content={<Close width="24" height="24" type="secondary" />}
            onClick={onClose}
          />
        </Modal.Header>
        <Modal.Content className="categories-modal__content">
          {
            <CategoriesFilters
              categories={categories.map((category) => {
                const withActiveUpdated = {
                  ...category,
                  active: selectedCategories.has(category.name),
                }
                return withActiveUpdated
              })}
              onChange={onFilterChange}
              filtersIcon={<Check width="20" height="20" />}
            />
          }
        </Modal.Content>
        <Modal.Actions className="categories-modal__footer">
          <Button
            primary
            size="medium"
            content="Apply Selection"
            onClick={(e) => onApplySelection(e, [...selectedCategories])}
            disabled={selectedCategories.size === 0}
          />
        </Modal.Actions>
      </Modal>
    )
  }
)
