import React, { useCallback, useEffect, useMemo, useState } from "react"

import { Helmet } from "react-helmet"

import { useLocation } from "@gatsbyjs/reach-router"
import MaintenancePage from "decentraland-gatsby/dist/components/Layout/MaintenancePage"
import useFeatureFlagContext from "decentraland-gatsby/dist/context/FeatureFlag/useFeatureFlagContext"
import useTrackContext from "decentraland-gatsby/dist/context/Track/useTrackContext"
import useAsyncTask from "decentraland-gatsby/dist/hooks/useAsyncTask"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Link } from "decentraland-gatsby/dist/plugins/intl"
import API from "decentraland-gatsby/dist/utils/api/API"
import env from "decentraland-gatsby/dist/utils/env"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import Grid from "semantic-ui-react/dist/commonjs/collections/Grid"

import Places from "../api/Places"
import Navigation, { NavigationTab } from "../components/Layout/Navigation"
import NoResults from "../components/Layout/NoResults"
import PlaceList from "../components/Place/PlaceList/PlaceList"
import WorldLabel from "../components/World/WorldLabel/WorldLabel"
import { AggregatePlaceAttributes } from "../entities/Place/types"
import { WorldListOptions } from "../entities/World/types"
import usePlacesManager from "../hooks/usePlacesManager"
import informationIcon from "../images/Information-icon.svg"
import { FeatureFlags } from "../modules/ff"
import { toWorldsOptions } from "../modules/locations"
import { SegmentPlace } from "../modules/segment"

import "./worlds.css"

const PAGE_SIZE = 24

const WORLDS_FIND_OUT_URL = env(
  `WORLDS_FIND_OUT_URL`,
  `https://decentraland.org/blog/announcements/introducing-decentraland-worlds-beta-your-own-3d-space-in-the-metaverse`
)

export default function WorldsPage() {
  const l = useFormatMessage()
  const location = useLocation()
  const track = useTrackContext()
  const params = useMemo(
    () => toWorldsOptions(new URLSearchParams(location.search)),
    [location.search]
  )
  const [offset, setOffset] = useState(0)

  const isSearching = !!params.search && params.search.length > 2
  const search = (isSearching && params.search) || ""

  const [totalWorlds, setTotalWorlds] = useState(0)
  const [allWorlds, setAllWorlds] = useState<AggregatePlaceAttributes[]>([])

  const [loadingWorlds, loadWorlds] = useAsyncTask(async () => {
    const options: Partial<WorldListOptions> = API.fromPagination(params, {
      pageSize: PAGE_SIZE,
    })

    const placesFetch = await Places.get().getWorlds({
      ...options,
      offset: offset,
      search: isSearching ? search : undefined,
    })

    if (isSearching) {
      track(SegmentPlace.WorldsSearch, {
        resultsCount: placesFetch.total,
        top10: placesFetch.data.slice(0, 10),
        search,
        place: SegmentPlace.Worlds,
      })
      setAllWorlds(placesFetch.data)
    } else {
      setAllWorlds((allWorlds) => [...allWorlds, ...placesFetch.data])
    }

    if (Number.isSafeInteger(placesFetch.total)) {
      setTotalWorlds(placesFetch.total)
    }
  }, [params, track])

  useEffect(() => {
    if (allWorlds.length === 0) {
      loadWorlds()
    }
  }, [params.only_favorites, params.order, params.order_by])

  useEffect(() => {
    setAllWorlds([])
    loadWorlds()
  }, [isSearching, search])

  useEffect(() => {
    setOffset(0)
  }, [
    search,
    isSearching,
    params.only_favorites,
    params.order,
    params.order_by,
  ])

  useEffect(() => {
    if (allWorlds.length > PAGE_SIZE) {
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

      loadWorlds()
      setOffset(offset + PAGE_SIZE)
    },
    [params, track, offset]
  )

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
          <Grid.Column tablet={16} className="worlds-page__list">
            <div className="worlds-page__disclamer">
              <img src={informationIcon} />
              <span>{l("pages.worlds.disclamer")}</span>
            </div>
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
            {!loading && isSearching && totalWorlds === 0 && (
              <NoResults search={search} />
            )}
          </Grid.Column>
        </Grid.Row>
      </Grid>
    </>
  )
}
