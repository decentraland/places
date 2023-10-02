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
import { navigate } from "decentraland-gatsby/dist/plugins/intl"
import API from "decentraland-gatsby/dist/utils/api/API"
import { Box } from "decentraland-ui/dist/components/Box/Box"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import { Dropdown } from "decentraland-ui/dist/components/Dropdown/Dropdown"
import { HeaderMenu } from "decentraland-ui/dist/components/HeaderMenu/HeaderMenu"
import { useMobileMediaQuery } from "decentraland-ui/dist/components/Media/Media"
import Select from "semantic-ui-react/dist/commonjs/addons/Select"
import Grid from "semantic-ui-react/dist/commonjs/collections/Grid"
import Icon from "semantic-ui-react/dist/commonjs/elements/Icon"

import Places from "../api/Places"
import { CategoriesList } from "../components/Categories/CategoriesList"
import { CategoryFilter } from "../components/Categories/CategoryFilter"
import { Trash } from "../components/Icon/Trash"
import Navigation, { NavigationTab } from "../components/Layout/Navigation"
import NoResults from "../components/Layout/NoResults"
import SearchInput from "../components/Layout/SearchInput"
import PlaceList from "../components/Place/PlaceList/PlaceList"
import { getPlaceListQuerySchema } from "../entities/Place/schemas"
import {
  AggregatePlaceAttributes,
  PlaceListOptions,
  PlaceListOrderBy,
} from "../entities/Place/types"
import usePlaceCategories from "../hooks/usePlaceCategories"
import usePlacesManager from "../hooks/usePlacesManager"
import { FeatureFlags } from "../modules/ff"
import locations, { toPlacesOptions } from "../modules/locations"
import { getPois } from "../modules/pois"
import { SegmentPlace } from "../modules/segment"

import "./places.css"

const PAGE_SIZE = 24

export default function IndexPage() {
  const l = useFormatMessage()
  const isMobile = useMobileMediaQuery()
  const location = useLocation()
  const track = useTrackContext()
  const params = useMemo(
    () => toPlacesOptions(new URLSearchParams(location.search)),
    [location.search]
  )
  const [offset, setOffset] = useState(0)

  const isSearching = !!params.search && params.search.length > 2
  const search = (isSearching && params.search) || ""

  const [totalPlaces, setTotalPlaces] = useState(0)
  const [allPlaces, setAllPlaces] = useState<AggregatePlaceAttributes[]>([])
  const categories = usePlaceCategories()

  const [loadingPlaces, loadPlaces] = useAsyncTask(async () => {
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

    const placesFetch = await Places.get().getPlaces({
      ...options,
      offset,
      search: isSearching ? search : undefined,
    })

    if (isSearching) {
      track(SegmentPlace.PlacesSearch, {
        resultsCount: placesFetch.total,
        top10: placesFetch.data.slice(0, 10),
        search,
        place: SegmentPlace.Places,
      })

      setAllPlaces(placesFetch.data)
    } else {
      const places: AggregatePlaceAttributes[] = [...allPlaces]
      for (const newPlace of placesFetch.data) {
        if (!places.find((place) => place.id == newPlace.id)) {
          places.push(newPlace)
        }
      }
      setAllPlaces(places)
    }

    if (Number.isSafeInteger(placesFetch.total)) {
      setTotalPlaces(placesFetch.total)
    }
  }, [params, track, offset])

  useEffect(() => {
    if (allPlaces.length === 0) {
      loadPlaces()
    }
  }, [
    params.only_favorites,
    params.only_featured,
    params.only_highlighted,
    params.only_pois,
    params.order,
    params.order_by,
    params.categories,
  ])

  useEffect(() => {
    setAllPlaces([])
    loadPlaces()
  }, [isSearching, search])

  useEffect(() => {
    setOffset(0)
  }, [
    search,
    isSearching,
    params.only_favorites,
    params.only_featured,
    params.only_highlighted,
    params.only_pois,
    params.order,
    params.order_by,
    params.categories,
  ])

  useEffect(() => {
    if (allPlaces.length > PAGE_SIZE) {
      setTimeout(
        () => window.scrollBy({ top: 500, left: 0, behavior: "smooth" }),
        0
      )
    }
  }, [allPlaces])

  const placesMemo = useMemo(() => [allPlaces], [allPlaces])

  const [[places], { handleFavorite, handlingFavorite }] =
    usePlacesManager(placesMemo)

  const loading = loadingPlaces

  const handleShowMore = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault()
      e.stopPropagation()
      track(SegmentPlace.FilterChange, {
        filters: params,
        place: SegmentPlace.PlacesShowMore,
        search,
      })
      loadPlaces()
      setOffset(offset + PAGE_SIZE)
    },
    [params, track, offset]
  )

  const handleChangeOrder = useCallback(
    (_: React.SyntheticEvent<any>, props: { value?: any }) => {
      const value =
        oneOf(props.value, getPlaceListQuerySchema.properties.order_by.enum) ??
        PlaceListOrderBy.LIKE_SCORE_BEST
      const newParams = { ...params, order_by: value, page: 1 }
      setAllPlaces([])
      track(SegmentPlace.FilterChange, {
        filters: newParams,
        place: SegmentPlace.PlacesChangeOrder,
      })
      navigate(locations.places(newParams))
    },
    [params, track]
  )

  const handleClearFilter = useCallback(() => {
    track(SegmentPlace.FilterClear)
    navigate(
      locations.places({
        order_by: PlaceListOrderBy.LIKE_SCORE_BEST,
      })
    )
  }, [params, track])

  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  )

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newParams = new URLSearchParams(searchParams)
      if (e.target.value) {
        newParams.set("search", e.target.value)
      } else {
        newParams.delete("search")
      }

      let target = location.pathname
      const search = newParams.toString()
      // location
      // navigate to /search+=?search=${search}
      if (search) {
        target += "?" + search
      }

      navigate(target)
    },
    [location.pathname, params]
  )

  function handleCategorySelection(action: "add", categoryId: string): void
  function handleCategorySelection(action: "remove", categoryId: string): void
  function handleCategorySelection(action: "clear"): void
  function handleCategorySelection(
    action: "add" | "remove" | "clear",
    categoryId?: string
  ): void {
    const newParams = new URLSearchParams(searchParams)
    let currentCategories = newParams.getAll("categories") || []
    if (action === "add") {
      currentCategories.push(categoryId!)
    }

    if (action === "remove") {
      currentCategories = currentCategories.filter((id) => id !== categoryId)
    }

    if (action === "clear") {
      currentCategories = []
    }

    newParams.delete("categories")

    for (const category of currentCategories) {
      newParams.append("categories", category)
    }

    setAllPlaces([])
    let target = location.pathname
    const params = newParams.toString()
    target += params ? "?" + params : ""
    navigate(target)
  }

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
          {isMobile && (
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
                <Box
                  header={
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{l("pages.places.category_filter_title")}</span>
                      <span>
                        {l("pages.places.categories_selected")}{" "}
                        {params.categories.length}
                      </span>
                    </div>
                  }
                  borderless
                  collapsible
                  defaultCollapsed={true}
                  className="places-page__category-filters_box--mobile"
                >
                  {categories.map(({ name }) => (
                    <CategoryFilter
                      notActive={!params.categories.includes(name)}
                      category={name}
                      onAddFilter={
                        !params.categories.includes(name)
                          ? () => handleCategorySelection("add", name)
                          : undefined
                      }
                    />
                  ))}
                </Box>
              </FilterContainerModal>
            </Grid.Column>
          )}
          {!isMobile && (
            <Grid.Column tablet={4}>
              <CategoriesList
                onSelect={(categoryId) =>
                  handleCategorySelection("add", categoryId)
                }
                categories={categories.map(({ name }) => name)}
              />
            </Grid.Column>
          )}
          <Grid.Column tablet={12} className="places-page__list">
            {isMobile && (
              <div className="places-page__search-input--mobile">
                <SearchInput
                  placeholder={l(`navigation.search.${NavigationTab.Places}`)}
                  onChange={handleSearchChange}
                  defaultValue={searchParams.get("search") || ""}
                />
              </div>
            )}
            {!isMobile && (
              <HeaderMenu stackable>
                <HeaderMenu.Left>
                  <SearchInput
                    placeholder={l(`navigation.search.${NavigationTab.Places}`)}
                    onChange={handleSearchChange}
                    defaultValue={searchParams.get("search") || ""}
                  />
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
            )}
            <div className="places-page__category-filters__box">
              <div className="places-page__category-filters__info">
                <p>
                  {totalPlaces} {l("social.places.title")}
                </p>
                {params.categories && params.categories.length > 0 && (
                  <Button
                    size="tiny"
                    className="clear-all-btn"
                    onClick={() => handleCategorySelection("clear")}
                    content={
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <Trash width="24" height="24" />{" "}
                        {l("pages.places.clear_all")}
                      </div>
                    }
                  />
                )}
              </div>
              {params.categories && params.categories.length > 0 && (
                <div>
                  {params.categories.map((category) => (
                    <CategoryFilter
                      category={category}
                      onRemoveFilter={() =>
                        handleCategorySelection("remove", category)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
            {allPlaces.length > 0 && (
              <PlaceList
                places={places}
                onClickFavorite={(_, place) => handleFavorite(place.id, place)}
                loadingFavorites={handlingFavorite}
                dataPlace={SegmentPlace.Places}
                search={search}
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
            {!loading && totalPlaces > places.length && (
              <div className="places__pagination">
                <Button primary inverted onClick={handleShowMore}>
                  {l("pages.places.show_more")}
                </Button>
              </div>
            )}
            {!loading && isSearching && totalPlaces === 0 && (
              <NoResults search={search} />
            )}
          </Grid.Column>
        </Grid.Row>
      </Grid>
    </>
  )
}
