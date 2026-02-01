import React, { useCallback, useEffect, useMemo, useState } from "react"

import { Helmet } from "react-helmet"

import MaintenancePage from "decentraland-gatsby/dist/components/Layout/MaintenancePage"
import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useFeatureFlagContext from "decentraland-gatsby/dist/context/FeatureFlag/useFeatureFlagContext"
import isAdmin from "decentraland-gatsby/dist/entities/Auth/isAdmin"
import useAsyncTask from "decentraland-gatsby/dist/hooks/useAsyncTask"
import useAsyncTasks from "decentraland-gatsby/dist/hooks/useAsyncTasks"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { navigate } from "decentraland-gatsby/dist/plugins/intl"
import API from "decentraland-gatsby/dist/utils/api/API"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import { Container } from "decentraland-ui/dist/components/Container/Container"
import { Header } from "decentraland-ui/dist/components/Header/Header"
import { HeaderMenu } from "decentraland-ui/dist/components/HeaderMenu/HeaderMenu"
import { Loader } from "decentraland-ui/dist/components/Loader/Loader"
import { SignIn } from "decentraland-ui/dist/components/SignIn/SignIn"
import { Tabs } from "decentraland-ui/dist/components/Tabs/Tabs"

import Places from "../../api/Places"
import Navigation, { NavigationTab } from "../../components/Layout/Navigation"
import SearchInput from "../../components/Layout/SearchInput"
import AdminPlaceCard from "../../components/Place/AdminPlaceCard/AdminPlaceCard"
import { AggregatePlaceAttributes } from "../../entities/Place/types"
import { FeatureFlags } from "../../modules/ff"
import locations from "../../modules/locations"

import "./highlights.css"

const PAGE_SIZE = 24

type TabType = "all" | "highlighted" | "worlds"

export default function AdminHighlightsPage() {
  const l = useFormatMessage()
  const [account, accountState] = useAuthContext()
  const admin = isAdmin(account)
  const [ff] = useFeatureFlagContext()

  const [places, setPlaces] = useState<AggregatePlaceAttributes[]>([])
  const [totalPlaces, setTotalPlaces] = useState(0)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<TabType>("all")

  const [loadingPlaces, loadPlaces] = useAsyncTask(async () => {
    const options = API.fromPagination({ page: 1 }, { pageSize: PAGE_SIZE })

    const response = {
      total: 0,
      data: [] as AggregatePlaceAttributes[],
      ok: false,
    }

    const searchOptions = {
      ...options,
      offset,
      search: search.length >= 3 ? search : undefined,
      only_highlighted: activeTab === "highlighted" ? true : undefined,
    }

    if (activeTab === "worlds") {
      const worldsFetch = await Places.get().getWorlds(searchOptions)
      response.data = worldsFetch.data
      response.ok = worldsFetch.ok
      response.total = worldsFetch.total
    } else {
      const placesFetch = await Places.get().getPlaces(searchOptions)
      response.data = placesFetch.data
      response.ok = placesFetch.ok
      response.total = placesFetch.total
    }

    if (offset === 0) {
      setPlaces(response.data)
    } else {
      setPlaces((prev) => [...prev, ...response.data])
    }

    setTotalPlaces(response.total)
  }, [offset, search, activeTab])

  const [handlingHighlight, handleHighlight] = useAsyncTasks(
    async (id, highlighted: boolean) => {
      const response = await Places.get().updateHighlight(id, highlighted)
      if (response) {
        setPlaces((prev) =>
          prev.map((place) =>
            place.id === id ? { ...place, highlighted } : place
          )
        )
      }
    },
    []
  )

  useEffect(() => {
    if (admin) {
      loadPlaces()
    }
  }, [admin, offset, search, activeTab])

  useEffect(() => {
    setOffset(0)
    setPlaces([])
  }, [search, activeTab])

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value)
    },
    []
  )

  const handleShowMore = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      setOffset(offset + PAGE_SIZE)
    },
    [offset]
  )

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab)
    setOffset(0)
    setPlaces([])
  }, [])

  const modifyingHighlight = useMemo(
    () => new Set(handlingHighlight),
    [handlingHighlight]
  )

  if (ff.flags[FeatureFlags.Maintenance]) {
    return <MaintenancePage />
  }

  if (accountState.loading || !account) {
    return (
      <>
        <Helmet>
          <title>
            {l("pages.admin.highlights.title") || "Admin - Highlights"}
          </title>
        </Helmet>
        <Navigation activeTab={NavigationTab.Admin} />
        <Container>
          <SignIn
            isConnecting={accountState.loading}
            onConnect={accountState.authorize}
          />
        </Container>
      </>
    )
  }

  if (!admin) {
    return (
      <>
        <Helmet>
          <title>
            {l("pages.admin.highlights.title") || "Admin - Highlights"}
          </title>
        </Helmet>
        <Navigation activeTab={NavigationTab.Admin} />
        <Container>
          <Header size="large">
            {l("pages.admin.highlights.access_denied")}
          </Header>
          <p>{l("pages.admin.highlights.admin_only")}</p>
        </Container>
      </>
    )
  }

  return (
    <>
      <Helmet>
        <title>
          {l("pages.admin.highlights.title") || "Admin - Highlights"}
        </title>
      </Helmet>
      <Navigation activeTab={NavigationTab.Admin} />
      <Container className="admin-highlights-page">
        <Header size="large">{l("pages.admin.highlights.title")}</Header>
        <p className="admin-highlights-page__description">
          {l("pages.admin.highlights.description")}
        </p>

        <Tabs>
          <Tabs.Tab
            active={activeTab === "all"}
            onClick={() => handleTabChange("all")}
          >
            {l("pages.admin.highlights.tab_all")}
          </Tabs.Tab>
          <Tabs.Tab
            active={activeTab === "highlighted"}
            onClick={() => handleTabChange("highlighted")}
          >
            {l("pages.admin.highlights.tab_highlighted")}
          </Tabs.Tab>
          <Tabs.Tab
            active={activeTab === "worlds"}
            onClick={() => handleTabChange("worlds")}
          >
            {l("pages.admin.highlights.tab_worlds")}
          </Tabs.Tab>
        </Tabs>

        <div className="admin-highlights-page__header">
          <HeaderMenu stackable>
            <HeaderMenu.Left>
              <SearchInput
                placeholder={l("pages.admin.highlights.search_placeholder")}
                onChange={handleSearchChange}
                defaultValue={search}
              />
            </HeaderMenu.Left>
            <HeaderMenu.Right>
              <span className="admin-highlights-page__count">
                {totalPlaces} {l("pages.admin.highlights.results")}
              </span>
            </HeaderMenu.Right>
          </HeaderMenu>
        </div>

        {loadingPlaces && places.length === 0 && (
          <Loader active size="massive" />
        )}

        <div className="admin-highlights-page__list">
          {places.map((place) => (
            <AdminPlaceCard
              key={place.id}
              place={place}
              loading={modifyingHighlight.has(place.id)}
              onToggleHighlight={(highlighted) =>
                handleHighlight(place.id, highlighted)
              }
            />
          ))}
        </div>

        {!loadingPlaces && places.length === 0 && (
          <div className="admin-highlights-page__empty">
            <p>{l("pages.admin.highlights.no_results")}</p>
          </div>
        )}

        {!loadingPlaces && totalPlaces > places.length && (
          <div className="admin-highlights-page__pagination">
            <Button primary inverted onClick={handleShowMore}>
              {l("pages.admin.highlights.show_more")}
            </Button>
          </div>
        )}

        {loadingPlaces && places.length > 0 && (
          <Loader active size="small" inline="centered" />
        )}
      </Container>
    </>
  )
}
