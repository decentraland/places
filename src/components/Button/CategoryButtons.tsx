import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Link } from "decentraland-gatsby/dist/plugins/intl"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Button } from "decentraland-ui/dist/components/Button/Button"

import { PlaceListOrderBy } from "../../entities/Place/types"
import locations from "../../modules/locations"

import "./CategoryButtons.css"

type CategoryButtonsProps = {
  categories: string[]
  className?: string
}

export const CategoryButtons = (props: CategoryButtonsProps) => {
  const { categories, className } = props
  const l = useFormatMessage()

  return (
    <div className={TokenList.join(["category-buttons__container", className])}>
      {categories.map((category) => (
        <Button
          as={Link}
          key={category}
          className="category-button"
          content={l(`categories.${category}`)}
          href={locations.places({
            categories: [category],
            order_by: PlaceListOrderBy.LIKE_SCORE_BEST,
          })}
        />
      ))}
    </div>
  )
}
