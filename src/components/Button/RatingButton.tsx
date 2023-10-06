import React, { useCallback } from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { SceneContentRating } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"

import "./RatingButton.css"

export type RatingButtonProps = {
  onChangeRating?: (
    e: React.MouseEvent<HTMLDivElement>,
    props: RatingButtonProps
  ) => void
  rating: SceneContentRating
  active: boolean
}

export default React.memo(function RatingButton(props: RatingButtonProps) {
  const { onChangeRating, active } = props
  const l = useFormatMessage()
  const rating = props.rating.toLowerCase()

  const handleOnClick = useCallback(
    (e) => onChangeRating && onChangeRating(e, props),
    [props, onChangeRating]
  )
  return (
    <div
      className={TokenList.join([
        "rating-button",
        `rating-${rating}`,
        active && "selected",
      ])}
      onClick={handleOnClick}
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
