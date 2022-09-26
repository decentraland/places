import React, { useCallback, useMemo } from "react"

import Helmet from "react-helmet"

import { useLocation } from "@gatsbyjs/reach-router"
import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useAsyncState from "decentraland-gatsby/dist/hooks/useAsyncState"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { navigate } from "decentraland-gatsby/dist/plugins/intl"
import API from "decentraland-gatsby/dist/utils/api/API"
import { Card } from "decentraland-ui/dist/components/Card/Card"
import { Dropdown } from "decentraland-ui/dist/components/Dropdown/Dropdown"
import { Header } from "decentraland-ui/dist/components/Header/Header"
import { HeaderMenu } from "decentraland-ui/dist/components/HeaderMenu/HeaderMenu"
import { Pagination } from "decentraland-ui/dist/components/Pagination/Pagination"
import { ToggleBox } from "decentraland-ui/dist/components/ToggleBox/ToggleBox"
import Grid from "semantic-ui-react/dist/commonjs/collections/Grid"

import Places from "../api/Places"
import Navigation, { NavigationTab } from "../components/Layout/Navigation"
import PlaceCard from "../components/Place/PlaceCard/PlaceCard"
import { PlaceListOptions } from "../entities/Place/types"
import locations, { toPlacesOptions } from "../modules/locations"
import { getPois } from "../modules/pois"

import "./places.css"

const PAGE_SIZE = 24

export default function IndexPage() {
  const l = useFormatMessage()
  const location = useLocation()
  const params = useMemo(
    () => toPlacesOptions(new URLSearchParams(location.search)),
    [location.search]
  )
  const [places, placesState] = useAsyncState(
    async () => {
      const { only_pois, ...extra } = API.fromPagination(params, {
        pageSize: PAGE_SIZE,
      })
      const options: Partial<PlaceListOptions> = extra
      if (only_pois) {
        const pois = await getPois()
        options.positions = pois
      }

      return Places.get().getPlaces(options)
    },
    [params],
    {
      callWithTruthyDeps: true,
    }
  )

  const loading = placesState.version === 0 || placesState.loading
  const length = places?.data.length || 0
  const total = places?.total || 1

  const handleChangePage = useCallback(
    (e: React.SyntheticEvent<any>, props: { activePage?: number | string }) => {
      e.preventDefault()
      e.stopPropagation()
      navigate(
        locations.places({ ...params, page: Number(props.activePage ?? 1) })
      )
    },
    [params]
  )

  const handleChangePois = useCallback(
    (e: React.SyntheticEvent<any>, props: { value?: any }) => {
      e.preventDefault()
      e.stopPropagation()
      navigate(locations.places({ ...params, only_pois: !!props.value }))
    },
    [params]
  )

  return (
    <>
      <Helmet>
        <title>{l("social.places.title") || ""}</title>
        <meta
          name="description"
          content={l("social.places.description") || ""}
        />

        <meta property="og:title" content={l("social.places.title") || ""} />
        <meta
          property="og:description"
          content={l("social.places.description") || ""}
        />
        <meta property="og:image" content={l("social.places.image") || ""} />
        <meta property="og:site" content={l("social.places.site") || ""} />

        <meta name="twitter:title" content={l("social.places.title") || ""} />
        <meta
          name="twitter:description"
          content={l("social.places.description") || ""}
        />
        <meta name="twitter:image" content={l("social.places.image") || ""} />
        <meta name="twitter:card" content={l("social.places.card") || ""} />
        <meta
          name="twitter:creator"
          content={l("social.places.creator") || ""}
        />
        <meta name="twitter:site" content={l("social.places.site") || ""} />
      </Helmet>
      <Navigation activeTab={NavigationTab.Places} />
      <Grid stackable className="places-page">
        <Grid.Row>
          <Grid.Column tablet={4} className="places-page__filters">
            <ToggleBox
              header="filters"
              onClick={handleChangePois}
              borderless
              value={Number(params.only_pois)}
              items={[
                { title: "All", value: 0, description: "" },
                { title: "Pois", value: 1, description: "" },
              ]}
            />
          </Grid.Column>
          <Grid.Column tablet={12} className="places-page__list">
            <div>
              <HeaderMenu stackable>
                <HeaderMenu.Left>
                  <Header sub>
                    {l("general.count_places", { count: total })}
                  </Header>
                </HeaderMenu.Left>
                <HeaderMenu.Right>
                  <Dropdown text="Newest" direction="left">
                    <Dropdown.Menu>
                      <Dropdown.Item text="Newest" />
                    </Dropdown.Menu>
                  </Dropdown>
                </HeaderMenu.Right>
              </HeaderMenu>
            </div>
            {loading && (
              <div>
                <Card.Group>
                  {Array.from(Array(PAGE_SIZE), (_, i) => {
                    return <PlaceCard key={i} loading />
                  })}
                </Card.Group>
              </div>
            )}
            {!loading && length > 0 && (
              <div>
                <Card.Group>
                  {(places?.data || []).map((place) => (
                    <PlaceCard key={place.id} place={place} />
                  ))}
                </Card.Group>
              </div>
            )}
            <div>
              <Pagination
                activePage={params.page}
                totalPages={Math.ceil(total / PAGE_SIZE)}
                onPageChange={handleChangePage}
              />
            </div>
          </Grid.Column>
        </Grid.Row>
      </Grid>
    </>
  )
}
