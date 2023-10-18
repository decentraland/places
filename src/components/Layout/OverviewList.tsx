import React from "react"

import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { navigate } from "decentraland-gatsby/dist/plugins/intl"
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import { Container } from "decentraland-ui/dist/components/Container/Container"
import { Header } from "decentraland-ui/dist/components/Header/Header"
import { HeaderMenu } from "decentraland-ui/dist/components/HeaderMenu/HeaderMenu"
import Icon from "semantic-ui-react/dist/commonjs/elements/Icon"

import { AggregatePlaceAttributes } from "../../entities/Place/types"
import useCardsByWidth from "../../hooks/useCardsByWidth"
import { SegmentPlace } from "../../modules/segment"
import PlaceList from "../Place/PlaceList/PlaceList"

import "./OverviewList.css"

type BaseOverviewListProps = {
  places: AggregatePlaceAttributes[]
  title: string | React.ReactNode
  loading: boolean
  onClickFavorite: (
    e: React.MouseEvent<HTMLButtonElement>,
    place: AggregatePlaceAttributes
  ) => void
  className?: string
  loadingFavorites: Set<string>
  dataPlace: SegmentPlace
  search?: string
  searchResultCount?: number
  trackingId?: string
}

type OverviewListPropsWithHref = BaseOverviewListProps & {
  href: string
  onClick?: never
}
type OverviewListPropsWithOnClick = BaseOverviewListProps & {
  onClick: () => void
  href?: never
}

export type OverviewListProps =
  | OverviewListPropsWithHref
  | OverviewListPropsWithOnClick

export default React.memo(function OverviewList(props: OverviewListProps) {
  const {
    places,
    title,
    loading,
    onClickFavorite,
    loadingFavorites,
    dataPlace,
    searchResultCount,
    search,
  } = props
  const l = useFormatMessage()

  // TODO: change the way this values are set
  const cardsToShow = useCardsByWidth({
    cardWidth: 300,
    cardMargin: 14,
    containerMargin: 48,
  })

  return (
    <div className={TokenList.join(["ui overview-list", props.className])}>
      <Container className="full">
        <HeaderMenu>
          <HeaderMenu.Left>
            <Header>{title}</Header>
            {!!searchResultCount && (
              <p className="overview-search__results">
                {searchResultCount}{" "}
                {l("components.overview_list.search_results_count")}
                <b> "{search}"</b>
              </p>
            )}
          </HeaderMenu.Left>
          <HeaderMenu.Right>
            {props.href && (
              <Button
                basic
                as="a"
                href={props.href}
                onClick={(e) => {
                  e.preventDefault()
                  navigate(props.href)
                }}
              >
                {l("components.overview_list.view_all")}
                <Icon
                  name="chevron right"
                  className="overview-list__view-all"
                />
              </Button>
            )}
            {props.onClick && (
              <Button
                basic
                as="button"
                onClick={(e) => {
                  e.preventDefault()
                  props.onClick()
                }}
              >
                {l("components.overview_list.view_all")}
                <Icon
                  name="chevron right"
                  className="overview-list__view-all"
                />
              </Button>
            )}
          </HeaderMenu.Right>
        </HeaderMenu>
      </Container>
      <Container className="full">
        <PlaceList
          places={places}
          onClickFavorite={onClickFavorite}
          loading={loading}
          className="overview-list__place-list"
          size={cardsToShow}
          loadingFavorites={loadingFavorites}
          dataPlace={dataPlace}
          trackingId={props.trackingId ? props.trackingId : undefined}
        />
      </Container>
    </div>
  )
})
