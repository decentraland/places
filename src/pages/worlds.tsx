import React, { useCallback, useEffect, useMemo, useState } from "react"

import { Helmet } from "react-helmet"

import { useLocation } from "@gatsbyjs/reach-router"
import MaintenancePage from "decentraland-gatsby/dist/components/Layout/MaintenancePage"
import FilterContainerModal from "decentraland-gatsby/dist/components/Modal/FilterContainerModal"
import useFeatureFlagContext from "decentraland-gatsby/dist/context/FeatureFlag/useFeatureFlagContext"
import useTrackContext from "decentraland-gatsby/dist/context/Track/useTrackContext"
import { oneOf } from "decentraland-gatsby/dist/entities/Schema/utils"
import useAsyncTask from "decentraland-gatsby/dist/hooks/useAsyncTask"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Link, navigate } from "decentraland-gatsby/dist/plugins/intl"
import API from "decentraland-gatsby/dist/utils/api/API"
import env from "decentraland-gatsby/dist/utils/env"
import { Box } from "decentraland-ui/dist/components/Box/Box"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import { Dropdown } from "decentraland-ui/dist/components/Dropdown/Dropdown"
import { HeaderMenu } from "decentraland-ui/dist/components/HeaderMenu/HeaderMenu"
import { useMobileMediaQuery } from "decentraland-ui/dist/components/Media/Media"
import Select from "semantic-ui-react/dist/commonjs/addons/Select"
import Grid from "semantic-ui-react/dist/commonjs/collections/Grid"
import Icon from "semantic-ui-react/dist/commonjs/elements/Icon"

import Places from "../api/Places"
import Navigation, { NavigationTab } from "../components/Layout/Navigation"
import PlaceList from "../components/Place/PlaceList/PlaceList"
import WorldLabel from "../components/World/WorldLabel/WorldLabel"
import { AggregatePlaceAttributes } from "../entities/Place/types"
import { getWorldListQuerySchema } from "../entities/World/schemas"
import { WorldListOptions, WorldListOrderBy } from "../entities/World/types"
import usePlacesManager from "../hooks/usePlacesManager"
import { FeatureFlags } from "../modules/ff"
import locations, { toWorldsOptions } from "../modules/locations"
import { SegmentPlace } from "../modules/segment"

import "./worlds.css"

const PAGE_SIZE = 24

const WORLDS_FIND_OUT_URL = env(
  `WORLDS_FIND_OUT_URL`,
  `https://decentraland.org/blog/announcements/introducing-decentraland-worlds-beta-your-own-3d-space-in-the-metaverse`
)

export default function WorldsPage() {
  const l = useFormatMessage()
  const isMobile = useMobileMediaQuery()
  const location = useLocation()
  const track = useTrackContext()
  const params = useMemo(
    () => toWorldsOptions(new URLSearchParams(location.search)),
    [location.search]
  )

  const [totalWorlds, setTotalWorlds] = useState(0)
  const [allWorlds, setAllWorlds] = useState<AggregatePlaceAttributes[]>([])

  const [loadingWorlds, loadWorlds] = useAsyncTask(async () => {
    const options: Partial<WorldListOptions> = API.fromPagination(params, {
      pageSize: PAGE_SIZE,
    })

    track(SegmentPlace.FilterChange, {
      filters: options,
      place: SegmentPlace.Worlds,
    })
    const placesFetch = await Places.get().getWorlds({
      ...options,
      offset: allWorlds.length,
    })

    setAllWorlds((allWorlds) => [...allWorlds, ...placesFetch.data])

    if (placesFetch.total) {
      setTotalWorlds(placesFetch.total)
    }
  }, [params, track])

  useEffect(() => {
    if (allWorlds.length === 0) {
      loadWorlds()
    } else if (allWorlds.length > PAGE_SIZE) {
      setTimeout(
        () => window.scrollBy({ top: 500, left: 0, behavior: "smooth" }),
        0
      )
    }
  }, [allWorlds])

  const worldsMemo = useMemo(() => [allWorlds], [allWorlds])

  const [[places], { handleFavorite, handlingFavorite }] =
    usePlacesManager(worldsMemo)

  const loading = loadingWorlds

  const handleShowMore = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault()
      e.stopPropagation()
      track(SegmentPlace.FilterChange, {
        filters: params,
        place: SegmentPlace.WorldsShowMore,
      })
      loadWorlds()
    },
    [params, track]
  )

  const handleChangeOrder = useCallback(
    (_: React.SyntheticEvent<any>, props: { value?: any }) => {
      const value =
        oneOf(props.value, getWorldListQuerySchema.properties.order_by.enum) ??
        WorldListOrderBy.MOST_ACTIVE
      const newParams = { ...params, order_by: value, page: 1 }
      setAllWorlds([])
      track(SegmentPlace.FilterChange, {
        filters: newParams,
        place: SegmentPlace.WorldsChangeOrder,
      })
      navigate(locations.worlds(newParams))
    },
    [params, track]
  )

  const handleClearFilter = useCallback(() => {
    track(SegmentPlace.FilterClear)
    navigate(
      locations.worlds({
        order_by: WorldListOrderBy.MOST_ACTIVE,
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
      <Navigation activeTab={NavigationTab.Worlds} />
      <Grid stackable className="worlds-page">
        <Grid.Row>
          <Grid.Column width={16} className="worlds-page__description">
            <div>
              <div>
                <WorldLabel />
                <p>{l("pages.worlds.description")}</p>
              </div>
              <Button primary as={Link} href={WORLDS_FIND_OUT_URL}>
                {l("pages.worlds.find_out_more")}
              </Button>
            </div>
          </Grid.Column>
        </Grid.Row>
        <Grid.Row>
          {isMobile && (
            <Grid.Column tablet={4} className="worlds-page__filters">
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
                    options={getWorldListQuerySchema.properties.order_by.enum.map(
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
              </FilterContainerModal>
            </Grid.Column>
          )}
          <Grid.Column tablet={16} className="worlds-page__list">
            {!isMobile && (
              <div>
                <HeaderMenu stackable>
                  <HeaderMenu.Left>{}</HeaderMenu.Left>
                  <HeaderMenu.Right>
                    <Dropdown
                      text={l(`general.order_by.${params.order_by}`)}
                      direction="left"
                    >
                      <Dropdown.Menu>
                        {getWorldListQuerySchema.properties.order_by.enum.map(
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
            {allWorlds.length > 0 && (
              <PlaceList
                places={places}
                onClickFavorite={(_, place) => handleFavorite(place.id, place)}
                loadingFavorites={handlingFavorite}
                dataPlace={SegmentPlace.Places}
              />
            )}
            {loading && (
              <PlaceList
                className="worlds-page__list-loading"
                places={[]}
                onClickFavorite={() => {}}
                loading={true}
                size={PAGE_SIZE}
                dataPlace={SegmentPlace.Places}
              />
            )}
            {!loading && totalWorlds > places.length && (
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
