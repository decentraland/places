import React, { useCallback, useEffect, useMemo, useState } from "react"

import { Helmet } from "react-helmet"

import { useLocation } from "@gatsbyjs/reach-router"
import MaintenancePage from "decentraland-gatsby/dist/components/Layout/MaintenancePage"
import FilterContainerModal from "decentraland-gatsby/dist/components/Modal/FilterContainerModal"
import useFeatureFlagContext from "decentraland-gatsby/dist/context/FeatureFlag/useFeatureFlagContext"
import useTrackContext from "decentraland-gatsby/dist/context/Track/useTrackContext"
import { oneOf } from "decentraland-gatsby/dist/entities/Schema/utils"
import useAsyncState from "decentraland-gatsby/dist/hooks/useAsyncState"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { navigate } from "decentraland-gatsby/dist/plugins/intl"
import API from "decentraland-gatsby/dist/utils/api/API"
import { Box } from "decentraland-ui/dist/components/Box/Box"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import { Dropdown } from "decentraland-ui/dist/components/Dropdown/Dropdown"
import { Filter } from "decentraland-ui/dist/components/Filter/Filter"
import { HeaderMenu } from "decentraland-ui/dist/components/HeaderMenu/HeaderMenu"
import { useMobileMediaQuery } from "decentraland-ui/dist/components/Media/Media"
import Select from "semantic-ui-react/dist/commonjs/addons/Select"
import Grid from "semantic-ui-react/dist/commonjs/collections/Grid"
import Icon from "semantic-ui-react/dist/commonjs/elements/Icon"

import Places from "../api/Places"
import Navigation, { NavigationTab } from "../components/Layout/Navigation"
import PlaceList from "../components/Place/PlaceList/PlaceList"
import { getPlaceListQuerySchema } from "../entities/Place/schemas"
import {
  AggregatePlaceAttributes,
  PlaceListOptions,
  PlaceListOrderBy,
} from "../entities/Place/types"
import usePlacesManager from "../hooks/usePlacesManager"
import { FeatureFlags } from "../modules/ff"
import locations, { toPlacesOptions } from "../modules/locations"
import { getPois } from "../modules/pois"
import { SegmentPlace } from "../modules/segment"

import "./places.css"

const PAGE_SIZE = 24

const defaultResult = {
  data: [] as AggregatePlaceAttributes[],
  ok: true,
  total: 0,
}

export default function IndexPage() {
  const l = useFormatMessage()
  const mobile = useMobileMediaQuery()
  const location = useLocation()
  const track = useTrackContext()
  const [page, setPage] = useState(1)
  const params = useMemo(
    () => toPlacesOptions(new URLSearchParams(location.search)),
    [location.search]
  )
  const [result, placesState] = useAsyncState(
    async () => {
      const { only_pois, ...extra } = API.fromPagination(params, {
        pageSize: PAGE_SIZE,
      })
      const options: Partial<PlaceListOptions> = extra
      if (only_pois) {
        const pois = await getPois()
        options.positions = pois
      }
      track(SegmentPlace.FilterChange, {
        filters: options,
        place: SegmentPlace.Places,
      })

      return Places.get().getPlaces(options)
    },
    [params, track],
    {
      callWithTruthyDeps: true,
      initialValue: defaultResult,
    }
  )

  const [allPlaces, setAllPlaces] = useState<AggregatePlaceAttributes[]>([])

  useEffect(() => {
    if (allPlaces.length !== 0) {
      setTimeout(
        () => window.scrollBy({ top: 500, left: 0, behavior: "smooth" }),
        0
      )
    }
    setAllPlaces((allPlaces) => [...allPlaces, ...result.data])
  }, [result.data])

  const placesMemo = useMemo(() => [allPlaces], [allPlaces])

  const [[places], { handleFavorite, handlingFavorite }] =
    usePlacesManager(placesMemo)

  const loading = placesState.version === 0 || placesState.loading

  const handleShowMore = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault()
      e.stopPropagation()
      const newPage = page + 1
      setPage(newPage)
      const newParams = { ...params, page: newPage }
      track(SegmentPlace.FilterChange, {
        filters: newParams,
        place: SegmentPlace.PlacesShowMore,
      })
      navigate(locations.places(newParams))
    },
    [params, page, track]
  )

  const handleChangePois = useCallback(
    (e: React.SyntheticEvent<any>, props: { value?: any }) => {
      e.preventDefault()
      e.stopPropagation()
      const newParams = {
        ...params,
        only_featured: false,
        only_pois: !!props.value,
        page: 1,
      }
      setAllPlaces([])
      setPage(1)
      track(SegmentPlace.FilterChange, {
        filters: newParams,
        place: SegmentPlace.PlacesChangePois,
      })
      navigate(locations.places(newParams))
    },
    [params, track]
  )

  const handleChangeFeatured = useCallback(
    (e: React.SyntheticEvent<any>, props: { value?: any }) => {
      e.preventDefault()
      e.stopPropagation()
      const newParams = {
        ...params,
        only_pois: false,
        only_featured: !!props.value,
        page: 1,
      }
      setAllPlaces([])
      setPage(1)
      track(SegmentPlace.FilterChange, {
        filters: newParams,
        place: SegmentPlace.PlacesChangePois,
      })
      navigate(locations.places(newParams))
    },
    [params, track]
  )

  const handleChangeOrder = useCallback(
    (_: React.SyntheticEvent<any>, props: { value?: any }) => {
      const value =
        oneOf(props.value, getPlaceListQuerySchema.properties.order_by.enum) ??
        PlaceListOrderBy.HIGHEST_RATED
      const newParams = { ...params, order_by: value, page: 1 }
      setAllPlaces([])
      setPage(1)
      track(SegmentPlace.FilterChange, {
        filters: newParams,
        place: SegmentPlace.PlacesChangePois,
      })
      navigate(locations.places(newParams))
    },
    [params, track]
  )

  const handleClearFilter = useCallback(() => {
    track(SegmentPlace.FilterClear)
    navigate(
      locations.places({
        order_by: PlaceListOrderBy.HIGHEST_RATED,
      })
    )
  }, [params, track])

  const [ff] = useFeatureFlagContext()

  if (ff.flags[FeatureFlags.Maintenance]) {
    return <MaintenancePage />
  }

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
          {mobile && (
            <Grid.Column tablet={4} className="places-page__filters">
              <FilterContainerModal
                title="Filters"
                action={
                  <>
                    <Icon name="filter" /> {l("pages.places.filters_title")}
                  </>
                }
                onClear={handleClearFilter}
              >
                <Box header={l("pages.places.sort_by")} borderless>
                  <Select
                    value={params.order_by}
                    text={l(`general.order_by.${params.order_by}`)}
                    onChange={handleChangeOrder}
                    options={getPlaceListQuerySchema.properties.order_by.enum.map(
                      (orderBy) => {
                        return {
                          key: orderBy,
                          value: orderBy,
                          text: l(`general.order_by.${orderBy}`),
                        }
                      }
                    )}
                  />
                </Box>
                <Box header={l("pages.places.filter")} borderless>
                  <div
                    onClick={(e) =>
                      handleChangePois(e, { value: !params.only_pois })
                    }
                    className="places-page__filter-container"
                  >
                    <Filter active={params.only_pois}>
                      {l("pages.places.pois")}
                    </Filter>
                  </div>
                  <div
                    onClick={(e) =>
                      handleChangeFeatured(e, { value: !params.only_featured })
                    }
                    className="places-page__filter-container"
                  >
                    <Filter active={params.only_featured}>
                      {l("pages.places.featured")}
                    </Filter>
                  </div>
                </Box>
              </FilterContainerModal>
            </Grid.Column>
          )}
          <Grid.Column tablet={16} className="places-page__list">
            {!mobile && (
              <div>
                <HeaderMenu stackable>
                  <HeaderMenu.Left>
                    <div
                      onClick={(e) =>
                        handleChangePois(e, { value: !params.only_pois })
                      }
                      className="places-page__filter-container"
                    >
                      <Filter active={params.only_pois}>
                        {l("pages.places.pois")}
                      </Filter>
                    </div>
                    <div
                      onClick={(e) =>
                        handleChangeFeatured(e, {
                          value: !params.only_featured,
                        })
                      }
                      className="places-page__filter-container"
                    >
                      <Filter active={params.only_featured}>
                        {l("pages.places.featured")}
                      </Filter>
                    </div>
                  </HeaderMenu.Left>
                  <HeaderMenu.Right>
                    <Dropdown
                      text={l(`general.order_by.${params.order_by}`)}
                      direction="left"
                    >
                      <Dropdown.Menu>
                        {getPlaceListQuerySchema.properties.order_by.enum.map(
                          (orderBy) => {
                            return (
                              <Dropdown.Item
                                value={orderBy}
                                text={l(`general.order_by.${orderBy}`)}
                                onClick={handleChangeOrder}
                              />
                            )
                          }
                        )}
                      </Dropdown.Menu>
                    </Dropdown>
                  </HeaderMenu.Right>
                </HeaderMenu>
              </div>
            )}
            {placesState.loaded && (
              <PlaceList
                places={places}
                onClickFavorite={(_, place) => handleFavorite(place.id, place)}
                loadingFavorites={handlingFavorite}
                dataPlace={SegmentPlace.Places}
              />
            )}
            {loading && (
              <PlaceList
                className="places-page__list-loading"
                places={[]}
                onClickFavorite={() => {}}
                loading={true}
                size={PAGE_SIZE}
                dataPlace={SegmentPlace.Places}
              />
            )}
            {!loading && result.total > places.length && (
              <div className="places__pagination">
                <Button primary inverted onClick={handleShowMore}>
                  {l("pages.places.show_more")}
                </Button>
              </div>
            )}
          </Grid.Column>
        </Grid.Row>
      </Grid>
    </>
  )
}
