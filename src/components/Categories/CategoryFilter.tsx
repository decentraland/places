import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Filter } from "decentraland-ui/dist/components/Filter/Filter"

import { Check } from "../Icon/Check"
import { Close } from "../Icon/Close"

import "./CategoryFilter.css"

type CategoryFilterProps = {
  category: string
  active?: boolean
  onRemoveFilter?: () => void
  onAddFilter?: () => void
  useCheck?: boolean
}

export const CategoryFilter = ({
  category,
  onRemoveFilter,
  onAddFilter,
  active,
  useCheck,
}: CategoryFilterProps) => {
  const l = useFormatMessage()

  return (
    <span
      className={`category-filter__box ${
        !active ? "category-filter__box--not-active" : ""
      }`}
      onClick={() => onAddFilter && onAddFilter()}
    >
      <Filter>
        {l(`categories.${category}`)}
        {active && (
          <span
            className="category-filter__remove-btn"
            onClick={onRemoveFilter ? () => onRemoveFilter() : undefined}
          >
            {useCheck ? (
              <Check width="20" height="20" />
            ) : (
              <Close width="20" height="20" />
            )}
          </span>
        )}
      </Filter>
    </span>
  )
}
