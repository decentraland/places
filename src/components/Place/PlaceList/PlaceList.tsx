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
  cantCard?: number
  className?: string
  loading?: boolean
}

export default React.memo(function PlaceList(props: PlaceListProps) {
  const { places, onClickFavorite, className, loading, cantCard } = props

  return (
    <div
      className={TokenList.join([
        "place-list__container",
        className && className,
      ])}
    >
      {places &&
        places.map((place, key) => (
          <PlaceCard
            key={key}
            place={place}
            loading={loading}
            onClickFavorite={onClickFavorite}
          />
        ))}
      {places &&
        cantCard &&
        places.length < cantCard &&
        [...Array(cantCard - places.length)].map((_, key) => (
          <PlaceCard
            key={key}
            loading={loading}
            isHidden={loading ? false : true}
          />
        ))}
    </div>
  )
})
