import React, { CSSProperties, useMemo } from "react"

import Carousel2, {
  IndicatorType,
} from "decentraland-gatsby/dist/components/Carousel2/Carousel2"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import {
  useMobileMediaQuery,
  useTabletAndBelowMediaQuery,
} from "decentraland-ui/dist/components/Media/Media"

import { AggregatePlaceAttributes } from "../../../entities/Place/types"
import useCardsByWidth from "../../../hooks/useCardsByWidth"
import { SegmentPlace } from "../../../modules/segment"
import PlaceCard from "../PlaceCard/PlaceCard"

import "./PlaceList.css"

export type PlaceListProps = {
  places: AggregatePlaceAttributes[]
  onClickFavorite: (
    e: React.MouseEvent<HTMLButtonElement>,
    place: AggregatePlaceAttributes
  ) => void
  dataPlace: SegmentPlace
  loadingFavorites?: Set<string>
  size?: number
  className?: string
  loading?: boolean
  search?: string
}

interface CustomCSSProperties extends CSSProperties {
  "--card-columns"?: string
}

export default React.memo(function PlaceList(props: PlaceListProps) {
  const {
    places,
    onClickFavorite,
    dataPlace,
    className,
    loading,
    size,
    loadingFavorites,
    search,
  } = props

  const isTablet = useTabletAndBelowMediaQuery()
  const isMobile = useMobileMediaQuery()

  // TODO: change the way this values are set
  const cardsToShow = useCardsByWidth({
    cardWidth: 300,
    cardMargin: 14,
    containerMargin: isTablet ? 14 : 48,
  })

  const placeListContainerStyle = useMemo(
    () => ({ "--card-columns": cardsToShow.toString() } as CustomCSSProperties),
    [cardsToShow]
  )

  return (
    <div
      className={TokenList.join([
        "place-list__container",
        className && className,
      ])}
      style={placeListContainerStyle}
    >
      {loading && isMobile && size && size < 10 && (
        <PlaceCard loading={loading} />
      )}
      {!loading && isMobile && size && size < 10 && (
        <Carousel2
          className="place-list__carousel"
          indicatorsType={IndicatorType.Dash}
          dynamicBullets={true}
          items={places}
          progress
          isNavigationHide
          component={(props) => (
            <PlaceCard
              key={props.item?.id}
              place={props.item}
              loading={loading}
              onClickFavorite={onClickFavorite}
              dataPlace={dataPlace}
              loadingFavorites={
                props.item?.id ? loadingFavorites?.has(props.item.id) : false
              }
              search={search}
            />
          )}
        />
      )}

      {(!isMobile || (isMobile && (!size || size >= 10))) &&
        Array.from(Array(size || places.length), (_, key) => {
          const place = places && places[key]
          return (
            <PlaceCard
              key={place?.id || key}
              place={place}
              loading={loading}
              onClickFavorite={onClickFavorite}
              dataPlace={dataPlace}
              loadingFavorites={
                place?.id ? loadingFavorites?.has(place.id) : false
              }
              search={search}
            />
          )
        })}
    </div>
  )
})
