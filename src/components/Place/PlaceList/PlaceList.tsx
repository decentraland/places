import React from "react"

import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"

import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import PlaceCard from "../PlaceCard/PlaceCard"

import "./PlaceList.css"

export type PlaceListProps = {
  places: AggregatePlaceAttributes[]
  onClickFavorite: (
    e: React.MouseEvent<HTMLButtonElement>,
    place: AggregatePlaceAttributes
  ) => void
  maxLength?: number
  className?: string
  loading?: boolean
}

export default React.memo(function PlaceList(props: PlaceListProps) {
  const { places, onClickFavorite, className, loading, maxLength } = props

  return (
    <div
      className={TokenList.join([
        "place-list__container",
        className && className,
      ])}
    >
      {Array.from(Array(maxLength), (_, key) => {
        const place = places && places[key]
        return (
          <PlaceCard
            key={place?.id || key}
            place={place}
            loading={loading}
            onClickFavorite={onClickFavorite}
          />
        )
      })}
    </div>
  )
})
