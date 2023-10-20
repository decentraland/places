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
import { v4 as uuidV4 } from "uuid"

import Places from "../api/Places"
import {
  CategoryFilter,
  CategoryFilterProps,
} from "../components/Category/CategoryFilter"
import { CategoryFilters } from "../components/Category/CategoryFilters"
import { CategoryList } from "../components/Category/CategoryList"
import { Close } from "../components/Icon/Close"
import { Filter as FilterIcon } from "../components/Icon/Filter"
import { Trash } from "../components/Icon/Trash"
import Navigation, { NavigationTab } from "../components/Layout/Navigation"
import NoResults from "../components/Layout/NoResults"
import OverviewList from "../components/Layout/OverviewList"
import SearchInput from "../components/Layout/SearchInput"
import { CategoryModal } from "../components/Modal/CategoryModal"
import PlaceList from "../components/Place/PlaceList/PlaceList"
import { getPlaceListQuerySchema } from "../entities/Place/schemas"
import {
  AggregatePlaceAttributes,
  PlaceListOrderBy,
} from "../entities/Place/types"
import usePlaceCategoriesManager from "../hooks/usePlaceCategoriesManager"
import usePlacesManager from "../hooks/usePlacesManager"
import { FeatureFlags } from "../modules/ff"
import locations, {
  PlacesPageOptions,
  toPlacesOptions,
} from "../modules/locations"
import { SegmentPlace } from "../modules/segment"

import "./places.css"

const PAGE_SIZE = 24

export default function IndexPage() {
  const l = useFormatMessage()
  const isMobile = useMobileMediaQuery()
  const location = useLocation()
  const track = useTrackContext()

  // TODO: remove one of these params
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

  const [trackingId, setTrackingId] = useState<string | null>(null)

  const isFilteringByCategory = params.categories.length > 0

  const [
    categories,
    previousActiveCategories,
    categoriesStack,
    { handleAddCategory, handleRemoveCategory, handleSyncCategory },
  ] = usePlaceCategoriesManager(params.categories)

  const [loadingPlaces, loadPlaces] = useAsyncTask(async () => {
    const options = API.fromPagination(params, {
      pageSize: PAGE_SIZE,
    })

    let response = {
      total: 0,
      data: [] as AggregatePlaceAttributes[],
      ok: false,
    }

    if (params.only_view_category) {
      const placesFetch = await Places.get().getPlaces({
        ...options,
        offset,
        categories: [params.only_view_category],
        search: isSearching ? search : undefined,
      })
      response.data = placesFetch.data
      response.ok = placesFetch.ok
      response.total = placesFetch.total
    }

    if (isFilteringByCategory && !params.only_view_category) {
      const categoriesFetch = []
      for (const category of params.categories) {
        const placesFetch = Places.get().getPlaces({
          ...options,
          offset,
          limit: 15,
          categories: [category],
          search: isSearching ? search : undefined,
        })
        categoriesFetch.push(placesFetch)
      }
      const responses = await Promise.all(categoriesFetch)

      for (const res of responses) {
        response.total += res.total
        response.data.push(...res.data)
      }
    } else if (!params.only_view_category) {
      const placesFetch = await Places.get().getPlaces({
        ...options,
        offset,
        search: isSearching ? search : undefined,
      })
      response = placesFetch
    }

    if (isFilteringByCategory || isSearching || params.only_view_category) {
      const newTrackingId = uuidV4()
      track(SegmentPlace.PlacesSearch, {
        trackingId: newTrackingId,
        resultsCount: response.total,
        top10: response.data.slice(0, 10),
        search,
        categories: isFilteringByCategory ? params.categories : undefined,
        viewAllCategory:
          params.only_view_category != ""
            ? params.only_view_category
            : undefined,
        orderBy: params.order_by,
        place: SegmentPlace.Places,
      })

      setTrackingId(newTrackingId as string)
    }

    if (isSearching) {
      setAllPlaces(response.data)
    } else {
      if (params.only_view_category) {
        setAllPlaces(response.data)
      } else {
        setAllPlaces((allPlaces) => [...allPlaces, ...response.data])
      }
    }

    if (Number.isSafeInteger(response.total)) {
      setTotalPlaces(response.total)
    }
  }, [params, track, offset])

  useEffect(() => {
    if (allPlaces.length === 0) {
      loadPlaces()
    }
  }, [
    params.only_favorites,
    params.only_highlighted,
    params.order,
    params.order_by,
    params.categories,
  ])

  useEffect(() => {
    setOffset(0)
  }, [
    search,
    isSearching,
    params.only_favorites,
    params.only_highlighted,
    params.order,
    params.order_by,
    params.categories,
  ])

  useEffect(() => {
    if (
      allPlaces.length > PAGE_SIZE &&
      !isFilteringByCategory &&
      !params.only_view_category
    ) {
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

      navigate(locations.places(newParams))
    },
    [params, track]
  )

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newParams: PlacesPageOptions = {
        ...params,
      }

      if (e.target.value) {
        newParams.search = e.target.value
      } else {
        newParams.search = ""
      }

      setAllPlaces([])
      navigate(locations.places(newParams))
    },
    [params]
  )

  const handleCategoriesFilterChange = useCallback(
    (newCategories: string[]) => {
      // change sorting when filter by categories
      const newParams: PlacesPageOptions = {
        ...params,
        categories: newCategories,
      }
      if (
        (!newParams.order_by ||
          newParams.order_by !== PlaceListOrderBy.LIKE_SCORE_BEST) &&
        newCategories.length > 0
      ) {
        newParams.order_by = PlaceListOrderBy.LIKE_SCORE_BEST
      } else if (!newCategories.length) {
        newParams.order_by = PlaceListOrderBy.MOST_ACTIVE
      }

      setAllPlaces([])
      navigate(locations.places(newParams))
    },
    [params]
  )

  const [ff] = useFeatureFlagContext()

  const toggleViewAllCategory = useCallback(
    (categoryId: string | null, back?: boolean) => {
      const newParams = { ...params }
      if (params.only_view_category) {
        newParams.only_view_category = ""
        if (!back) {
          newParams.categories = newParams.categories.filter(
            (category) => category != params.only_view_category
          )
        }
      } else {
        newParams.only_view_category = categoryId!
      }

      setAllPlaces([])
      navigate(locations.places(newParams))
    },
    [params]
  )

  const handleApplyCategoryListChange = useCallback(
    (
      e: React.MouseEvent<HTMLSpanElement, MouseEvent>,
      props: CategoryFilterProps
    ) => {
      const { active, category } = props

      const names = categories
        .filter(({ active }) => active)
        .map(({ name }) => name)

      if (active) {
        handleAddCategory(category)
        names.push(category)
      }

      if (!active) {
        handleRemoveCategory(category)

        names.splice(names.indexOf(category), 1)
      }

      handleCategoriesFilterChange(names)
    },
    [
      categories,
      handleAddCategory,
      handleRemoveCategory,
      handleCategoriesFilterChange,
    ]
  )

  const handleCategoryModalChange = useCallback(
    (
      e: React.MouseEvent<HTMLSpanElement, MouseEvent>,
      props: CategoryFilterProps
    ) => {
      const { active, category } = props
      active && handleAddCategory(category)
      !active && handleRemoveCategory(category)
    },
    [handleAddCategory, handleRemoveCategory]
  )

  const handleApplyModalChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (e: React.MouseEvent<HTMLSpanElement, MouseEvent>) => {
      const names = categories
        .filter(({ active }) => active)
        .map(({ name }) => name)

      handleCategoriesFilterChange(names)
      setIsCategoriesModalVisible(false)
    },
    [categories, handleCategoriesFilterChange]
  )

  const handleClearAll = useCallback(() => {
    if (previousActiveCategories.length) {
      handleCategoriesFilterChange([])
    } else {
      handleSyncCategory(
        categories.map((category) => ({
          ...category,
          active: false,
        }))
      )
    }
  }, [previousActiveCategories, categories])

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
          {!isMobile && !params.only_view_category && (
            <Grid.Column tablet={3}>
              <CategoryList
                onChange={handleApplyCategoryListChange}
                categories={categories}
              />
            </Grid.Column>
          )}
          <Grid.Column
            tablet={!params.only_view_category ? 13 : 16}
            className="places-page__list"
          >
            {isMobile && (
              <div className="places-page__search-input--mobile">
                <SearchInput
                  placeholder={l(`navigation.search.${NavigationTab.Places}`)}
                  onChange={handleSearchChange}
                  defaultValue={params.search}
                />
              </div>
            )}
            {!isMobile && (
              <HeaderMenu stackable>
                <HeaderMenu.Left>
                  <SearchInput
                    placeholder={l(`navigation.search.${NavigationTab.Places}`)}
                    onChange={handleSearchChange}
                    defaultValue={params.search}
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
                              key={orderBy}
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
            <div className="places-page__category-filters-box-container">
              <div className="places-page__category-filters-info">
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
                                key={orderBy}
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
                <div className="places-page__category-filters-box">
                  <CategoryFilters
                    categories={categories}
                    onlyActives
                    onChange={handleApplyCategoryListChange}
                    filtersIcon={<Close width="20" height="20" />}
                  />
                  <span
                    className="clear-all-filter-btn"
                    onClick={handleClearAll}
                  >
                    <Filter>
                      <Trash width="20" height="20" />{" "}
                      <p>{l("pages.places.clear_all")}</p>
                    </Filter>
                  </span>
                </div>
              )}
              {params.only_view_category && (
                <div className="only-view-category-navbar__box">
                  <Back onClick={() => toggleViewAllCategory(null, true)} />
                  <div>
                    <CategoryFilter
                      category={params.only_view_category}
                      active
                      onChange={() => toggleViewAllCategory(null, false)}
                      actionIcon={<Close width="20" height="20" />}
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
                  trackingId={trackingId ? trackingId : undefined}
                />
              )}
            {isFilteringByCategory &&
              !params.only_view_category &&
              categoriesStack.map((category) => (
                <OverviewList
                  key={category.name}
                  title={
                    <>
                      {l(`categories.${category.name}`)}{" "}
                      <span>{category.count}</span>
                    </>
                  }
                  places={places.filter((place) =>
                    place.categories.includes(category.name)
                  )}
                  onClick={() => toggleViewAllCategory(category.name)}
                  loadingFavorites={handlingFavorite}
                  search={search}
                  dataPlace={SegmentPlace.Places}
                  onClickFavorite={(_, place) => {
                    handleFavorite(place.id, place)
                  }}
                  loading={loadingPlaces}
                  trackingId={trackingId ? trackingId : undefined}
                />
              ))}
            {loading && (
              <PlaceList
                className="places-page__list-loading"
                places={[]}
                onClickFavorite={() => {}}
                loading={true}
                size={PAGE_SIZE}
                dataPlace={SegmentPlace.Places}
                trackingId={trackingId ? trackingId : undefined}
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
        {isMobile && (
          <CategoryModal
            open={isCategoriesModalVisible}
            categories={categories}
            onClose={() => {
              setIsCategoriesModalVisible(false)
              handleSyncCategory(
                categories.map((category) => ({
                  ...category,
                  active: !!previousActiveCategories.find(
                    ({ name }) => name === category.name
                  ),
                }))
              )
            }}
            onClearAll={() => {
              setIsCategoriesModalVisible(false)
              handleClearAll()
            }}
            onChange={handleCategoryModalChange}
            onActionClick={handleApplyModalChange}
          />
        )}
      </Grid>
    </>
  )
}
