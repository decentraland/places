import React, { useCallback, useMemo } from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import { Modal, ModalProps } from "decentraland-ui/dist/components/Modal/Modal"

import { Category } from "../../entities/Category/types"
import { CategoryFilterProps } from "../Category/CategoryFilter"
import { CategoryFilters } from "../Category/CategoryFilters"
import { Check } from "../Icon/Check"
import { Close } from "../Icon/Close"

import "./CategoryModal.css"

export type CategoryModalProps = ModalProps & {
  categories: Category[]
  onChange: (
    e: React.MouseEvent<HTMLSpanElement, MouseEvent>,
    props: CategoryFilterProps
  ) => void
  onClearAll: () => void
}

export const CategoryModal = React.memo((props: CategoryModalProps) => {
  const { categories, onChange, onClearAll, onClose, onActionClick, ...rest } =
    props

  const l = useFormatMessage()

  const selectedCategories = useMemo(
    () =>
      new Set(
        categories.filter(({ active }) => active).map(({ name }) => name)
      ),
    [categories]
  )

  const handleClose = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) =>
      onClose && onClose(e, { ...props, open: false }),
    [onClose]
  )

  const handleAction = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) =>
      onActionClick && onActionClick(e, props),
    [onActionClick]
  )

  return (
    <Modal {...rest} className="categories-modal__box">
      <Modal.Header className="categories-modal__header">
        <Button
          basic
          content={l("components.modal.category.clear_all")}
          onClick={onClearAll}
          disabled={selectedCategories.size === 0}
          className="clear-all"
        />
        <p
          className={TokenList.join([
            selectedCategories.size > 0 && "categories-modal__text--smaller",
          ])}
        >
          {selectedCategories.size
            ? l("components.modal.category.quantity_selected", {
                quantity: selectedCategories.size,
              })
            : l("components.modal.category.one_or_more")}
        </p>
        <Button
          className="close-btn"
          basic
          content={<Close width="24" height="24" type="secondary" />}
          onClick={handleClose}
        />
      </Modal.Header>
      <Modal.Content className="categories-modal__content">
        <CategoryFilters
          categories={categories}
          onChange={onChange}
          filtersIcon={<Check width="20" height="20" />}
        />
      </Modal.Content>
      <Modal.Actions className="categories-modal__footer">
        <Button
          primary
          size="medium"
          content="Apply Selection"
          onClick={handleAction}
          disabled={selectedCategories.size === 0}
        />
      </Modal.Actions>
    </Modal>
  )
})
