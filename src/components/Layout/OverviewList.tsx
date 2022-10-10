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
import PlaceList from "../Place/PlaceList/PlaceList"

import "./OverviewList.css"

export type OverviewListProps = {
  places: AggregatePlaceAttributes[]
  title: string
  href: string
  loading: boolean
  onClickFavorite: (
    e: React.MouseEvent<HTMLButtonElement>,
    place: AggregatePlaceAttributes
  ) => void
  className?: string
  loadingFavorites: Set<string>
}

export default React.memo(function OverviewList(props: OverviewListProps) {
  const { places, title, loading, href, onClickFavorite, loadingFavorites } =
    props
  const l = useFormatMessage()
  return (
    <div className={TokenList.join(["ui overview-list", props.className])}>
      <Container className="full">
        <HeaderMenu>
          <HeaderMenu.Left>
            <Header>{title}</Header>
          </HeaderMenu.Left>
          <HeaderMenu.Right>
            <Button
              basic
              as="a"
              href={href}
              onClick={(e) => {
                e.preventDefault()
                navigate(href)
              }}
            >
              {l("components.overview_list.view_all")}
              <Icon name="chevron right" className="overview-list__view-all" />
            </Button>
          </HeaderMenu.Right>
        </HeaderMenu>
      </Container>
      <Container className="full">
        <PlaceList
          places={places}
          onClickFavorite={onClickFavorite}
          loading={loading}
          className="overview-list__place-list"
          maxLength={5}
          loadingFavorites={loadingFavorites}
        />
      </Container>
    </div>
  )
})
