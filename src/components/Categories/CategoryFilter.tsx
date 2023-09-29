import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import { Filter } from "decentraland-ui/dist/components/Filter/Filter"

import { Close } from "../Icon/Close"

import "./CategoryFilter.css"

type CategoryFilterProps = {
  category: string
  notActive?: boolean
  onRemoveFilter?: () => void
  onAddFilter?: () => void
}

export const CategoryFilter = ({
  category,
  onRemoveFilter,
  onAddFilter,
  notActive,
}: CategoryFilterProps) => {
  const l = useFormatMessage()

  return (
    <span
      className={`category-filter__box ${
        notActive ? "category-filter__box--not-active" : ""
      }`}
      onClick={() => onAddFilter && onAddFilter()}
    >
      <Filter>
        {l(`categories.${category}`)}
        {onRemoveFilter && (
          <Button
            size="tiny"
            content={<Close width="24" height="24" />}
            className="category-filter__remove-btn"
            onClick={() => onRemoveFilter()}
          />
        )}
      </Filter>
    </span>
  )
}
