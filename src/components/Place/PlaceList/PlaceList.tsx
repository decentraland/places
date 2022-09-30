import React from "react"

import Carousel, {
  IndicatorsType,
} from "decentraland-gatsby/dist/components/Carousel/Carousel"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { useMobileMediaQuery } from "decentraland-ui/dist/components/Media/Media"

import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import PlaceCard from "../PlaceCard/PlaceCard"

import "./PlaceList.css"

export type PlaceListProps = {
  places: AggregatePlaceAttributes[]
  onClickFavorite: (
    e: React.MouseEvent<HTMLButtonElement>,
    place: AggregatePlaceAttributes
  ) => void
  loadingFavorites?: Set<string>
  maxLength?: number
  className?: string
  loading?: boolean
}

export default React.memo(function PlaceList(props: PlaceListProps) {
  const {
    places,
    onClickFavorite,
    className,
    loading,
    maxLength,
    loadingFavorites,
  } = props

  const isMobile = useMobileMediaQuery()
  return (
    <div
      className={TokenList.join([
        "place-list__container",
        className && className,
      ])}
    >
      {isMobile && maxLength && maxLength < 10 && (
        <Carousel
          className="place-list__carousel"
          indicatorsType={IndicatorsType.Dash}
        >
          {places.map((place, key) => (
            <PlaceCard
              key={place?.id || key}
              place={place}
              loading={loading}
              onClickFavorite={onClickFavorite}
              loadingFavorites={
                place?.id ? loadingFavorites?.has(place.id) : false
              }
            />
          ))}
        </Carousel>
      )}

      {(!isMobile || (isMobile && (!maxLength || maxLength >= 10))) &&
        Array.from(Array(maxLength || places.length), (_, key) => {
          const place = places && places[key]
          return (
            <PlaceCard
              key={place?.id || key}
              place={place}
              loading={loading}
              onClickFavorite={onClickFavorite}
              loadingFavorites={
                place?.id ? loadingFavorites?.has(place.id) : false
              }
            />
          )
        })}
    </div>
  )
})
