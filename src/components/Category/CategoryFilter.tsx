import React, { useCallback } from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Filter } from "decentraland-ui/dist/components/Filter/Filter"

import "./CategoryFilter.css"

export type CategoryFilterProps = {
  category: string
  onChange?: (
    e: React.MouseEvent<HTMLSpanElement, MouseEvent>,
    props: CategoryFilterProps
  ) => void
  active?: boolean
  actionIcon?: React.ReactNode
}

export const CategoryFilter = (props: CategoryFilterProps) => {
  const { category, active, onChange, actionIcon } = props
  const l = useFormatMessage()

  const handleClick = useCallback(
    (e) => onChange && onChange(e, { active: !active, category }),
    [active, onChange, category]
  )
  return (
    <span
      className={TokenList.join([
        `category-filter__box`,
        !active && "category-filter__box--not-active",
      ])}
      onClick={handleClick}
    >
      <Filter>
        {l(`categories.${category}`)}
        {active && <span className="category-filter__icon">{actionIcon}</span>}
      </Filter>
    </span>
  )
}
