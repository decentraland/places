import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"

import NoResults from "./NoResults"
import OverviewList from "./OverviewList"
import { AggregatePlaceAttributes } from "../../entities/Place/types"
import locations from "../../modules/locations"
import { SegmentPlace } from "../../modules/segment"

import "./SearchList.css"
import "./OverviewList.css"

export type SearchListProps = {
  isLoadingPlaces: boolean
  isLoadingWorlds: boolean
  placeResultList?: AggregatePlaceAttributes[]
  placeTotalResults?: number
  worldResultList?: AggregatePlaceAttributes[]
  worldTotalResults?: number
  search: string
  handleFavorite: (
    id: string,
    place: AggregatePlaceAttributes,
    tracking: Record<string, string>
  ) => void
  handlingFavorite: Set<string>
}

export default React.memo(function SearchList(props: SearchListProps) {
  const {
    placeResultList,
    placeTotalResults,
    worldResultList,
    worldTotalResults,
    handleFavorite,
    isLoadingPlaces,
    isLoadingWorlds,
    handlingFavorite,
    search,
  } = props

  const l = useFormatMessage()

  const hasNoResults =
    !isLoadingPlaces &&
    !isLoadingWorlds &&
    placeTotalResults === 0 &&
    worldTotalResults === 0

  if (hasNoResults) {
    return <NoResults search={search} />
  }

  return (
    <>
      <p className="search-results__header">
        {l("components.search.search_results_title")} <b>"{search}"</b>
      </p>

      {((placeTotalResults && placeTotalResults > 0) || isLoadingPlaces) && (
        <OverviewList
          places={placeResultList!}
          title={l("pages.overview.places")}
          href={locations.genesis({
            search,
          })}
          onClickFavorite={(e, place) =>
            handleFavorite(place.id, place, {
              place: e.currentTarget.dataset.place!,
            })
          }
          loading={isLoadingPlaces}
          loadingFavorites={handlingFavorite}
          dataPlace={SegmentPlace.OverviewMostActive}
          search={search}
          searchResultCount={placeTotalResults}
        />
      )}
      {((worldTotalResults && worldTotalResults > 0) || isLoadingWorlds) && (
        <OverviewList
          places={worldResultList!}
          title={l("pages.overview.worlds")}
          href={locations.worlds({
            search,
          })}
          onClickFavorite={(e, place) =>
            handleFavorite(place.id, place, {
              place: e.currentTarget.dataset.place!,
            })
          }
          loading={isLoadingWorlds}
          loadingFavorites={handlingFavorite}
          dataPlace={SegmentPlace.OverviewMostActive}
          search={search}
          searchResultCount={worldTotalResults}
        />
      )}
    </>
  )
})
