import React, { useCallback, useEffect, useMemo, useState } from "react"

import { Helmet } from "react-helmet"

import { useLocation } from "@gatsbyjs/reach-router"
import MaintenancePage from "decentraland-gatsby/dist/components/Layout/MaintenancePage"
import useFeatureFlagContext from "decentraland-gatsby/dist/context/FeatureFlag/useFeatureFlagContext"
import useTrackContext from "decentraland-gatsby/dist/context/Track/useTrackContext"
import { oneOf } from "decentraland-gatsby/dist/entities/Schema/utils"
import useAsyncTask from "decentraland-gatsby/dist/hooks/useAsyncTask"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { navigate } from "decentraland-gatsby/dist/plugins/intl"
import API from "decentraland-gatsby/dist/utils/api/API"
import { Back } from "decentraland-ui/dist/components/Back/Back"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import { Dropdown } from "decentraland-ui/dist/components/Dropdown/Dropdown"
import { Filter } from "decentraland-ui/dist/components/Filter/Filter"
import { HeaderMenu } from "decentraland-ui/dist/components/HeaderMenu/HeaderMenu"
import { useMobileMediaQuery } from "decentraland-ui/dist/components/Media/Media"
import Grid from "semantic-ui-react/dist/commonjs/collections/Grid"

import Places from "../api/Places"
import { CategoriesList } from "../components/Categories/CategoriesList"
import { CategoriesModal } from "../components/Categories/CategoriesModal"
import { CategoryFilter } from "../components/Categories/CategoryFilter"
import { Filter as FilterIcon } from "../components/Icon/Filter"
import { RedArrow } from "../components/Icon/RedArrow"
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

  const [isCategoriesModalVisible, setIsCategoriesModalVisible] =
    useState(false)

  const [totalPlaces, setTotalPlaces] = useState(0)
  const [allPlaces, setAllPlaces] = useState<AggregatePlaceAttributes[]>([])

  const isFilteringByCategory = params.categories.length > 0

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
      categories: params.only_view_category
        ? [params.only_view_category]
        : extra.categories,
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
      if (isFilteringByCategory) {
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
      if (!currentCategories.includes(categoryId!)) {
        currentCategories.push(categoryId!)
      } else {
        return
      }
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

  const toggleViewAllCategory = (categoryId?: string) => {
    const newParams = new URLSearchParams(searchParams)
    if (newParams.has("only_view_category")) {
      newParams.delete("only_view_category")
    } else {
      newParams.set("only_view_category", categoryId!)
    }

    let target = location.pathname
    const params = newParams.toString()
    target += params ? "?" + params : ""
    navigate(target)
  }

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
          {!isMobile && (
            <Grid.Column tablet={4}>
              <CategoriesList
                onSelect={(categoryId) =>
                  handleCategorySelection("add", categoryId)
                }
                categories={categories.map(({ name }) => ({
                  categoryId: name,
                  active: params.categories.includes(name),
                }))}
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
                {isMobile && (
                  <div>
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
                    <Button
                      content={<FilterIcon width="20" height="18" />}
                      size="tiny"
                      basic
                      onClick={() => setIsCategoriesModalVisible(true)}
                    />
                  </div>
                )}
              </div>
              {isFilteringByCategory && !params.only_view_category && (
                <div className="places-page__category-filters__filters-box">
                  {params.categories.map((category) => (
                    <CategoryFilter
                      category={category}
                      active
                      onRemoveFilter={() =>
                        handleCategorySelection("remove", category)
                      }
                    />
                  ))}
                  <span
                    className="clear-all-filter-btn"
                    onClick={() => handleCategorySelection("clear")}
                  >
                    <Filter>
                      <Trash width="24" height="24" />{" "}
                      <p>{l("pages.places.clear_all")}</p>
                    </Filter>
                  </span>
                </div>
              )}
              {params.only_view_category && (
                <div className="only-view-category-navbar__box">
                  <Back onClick={() => toggleViewAllCategory()} />
                  <div>
                    <CategoryFilter
                      category={params.only_view_category}
                      onRemoveFilter={() =>
                        toggleViewAllCategory(params.only_view_category)
                      }
                    />
                  </div>
                </div>
              )}
            </div>
            {allPlaces.length > 0 &&
              (!isFilteringByCategory || params.only_view_category) && (
                <PlaceList
                  places={places}
                  onClickFavorite={(_, place) =>
                    handleFavorite(place.id, place)
                  }
                  loadingFavorites={handlingFavorite}
                  dataPlace={SegmentPlace.Places}
                  search={search}
                />
              )}
            {isFilteringByCategory &&
              !params.only_view_category &&
              params.categories.map((c) => (
                <div className="places-page__category-breakdown__box">
                  <div className="places-page__category-breakdown__title">
                    <p>
                      {l(`categories.${c}`)}{" "}
                      <span>
                        {
                          categories.find((category) => category.name == c)
                            ?.count
                        }
                      </span>
                    </p>
                    <Button
                      content={
                        <div>
                          <p>{l("pages.overview.view_all")}</p>
                          <span>
                            <RedArrow width="15" height="26" />
                          </span>
                        </div>
                      }
                      basic
                      onClick={() => toggleViewAllCategory(c)}
                    />
                  </div>
                  <PlaceList
                    places={places
                      .filter((place) => place.category_id == c)
                      .slice(0, 4)}
                    onClickFavorite={(_, place) =>
                      handleFavorite(place.id, place)
                    }
                    loadingFavorites={handlingFavorite}
                    dataPlace={SegmentPlace.Places}
                    search={search}
                  />
                </div>
              ))}
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
            {!loading &&
              totalPlaces > places.length &&
              (!isFilteringByCategory || params.only_view_category) && (
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
        {isMobile && isCategoriesModalVisible && (
          <CategoriesModal
            categories={categories.map((category) => ({
              categoryId: category.name,
              active: params.categories.includes(category.name),
            }))}
            onClose={() => setIsCategoriesModalVisible(false)}
            onClearAll={() => {
              handleCategorySelection("clear")
              setIsCategoriesModalVisible(false)
            }}
            onApplySelection={(categoryIds) => {
              for (const category of categoryIds) {
                handleCategorySelection("add", category)
              }
            }}
          />
        )}
      </Grid>
    </>
  )
}
