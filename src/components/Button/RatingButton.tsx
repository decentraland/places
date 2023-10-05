import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"

import "./RatingButton.css"

export type RatingButtonProps = {
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void
  rating: SceneContentRating
  active: boolean
}

export default React.memo(function RatingButton(props: RatingButtonProps) {
  const { onClick, active } = props
  const l = useFormatMessage()
  const rating = props.rating.toLowerCase()
  return (
    <div
      className={TokenList.join([
        "rating-button",
        `rating-${rating}`,
        active && "selected",
      ])}
      onClick={onClick}
    >
      <h1 className="rating-label">
        {l(`components.rating_button.rating_${rating}`)}
      </h1>
      <label className="rating-label">
        {l(`components.rating_button.rating_${rating}_label`)}
      </label>
    </div>
  )
})
