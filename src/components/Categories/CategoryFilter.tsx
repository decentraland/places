import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Filter } from "decentraland-ui/dist/components/Filter/Filter"

import "./CategoryFilter.css"

type CategoryFilterProps = {
  category: string
  onChange?: (
    e: React.MouseEvent<HTMLSpanElement, MouseEvent>,
    props: { active: boolean; category: string }
  ) => void
  active?: boolean
  actionIcon?: React.ReactNode
}

export const CategoryFilter = ({
  category,
  active,
  onChange,
  actionIcon,
}: CategoryFilterProps) => {
  const l = useFormatMessage()

  return (
    <span
      className={TokenList.join([
        `category-filter__box`,
        active && "category-filter__box--not-active",
      ])}
      onClick={(e) => onChange && onChange(e, { active: !active, category })}
    >
      <Filter>
        {l(`categories.${category}`)}
        {active && <span className="category-filter__icon">{actionIcon}</span>}
      </Filter>
    </span>
  )
}
