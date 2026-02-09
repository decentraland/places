import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

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
import TokenList from "decentraland-gatsby/dist/utils/dom/TokenList"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import { Dropdown } from "decentraland-ui/dist/components/Dropdown/Dropdown"
import { HeaderMenu } from "decentraland-ui/dist/components/HeaderMenu/HeaderMenu"
import { useMobileMediaQuery } from "decentraland-ui/dist/components/Media/Media"
import { unique } from "radash"
import Grid from "semantic-ui-react/dist/commonjs/collections/Grid"

import Places from "../api/Places"
import Banner from "../components/Banner"
import BannerMobile from "../components/BannerMobile"
import { CategoryFilterProps } from "../components/Category/CategoryFilter"
import { CategoryList } from "../components/Category/CategoryList"
import OnlyViewCategoryNavbar from "../components/Category/OnlyViewCategoryNavbar"
import SelectedCategoriesNavbar from "../components/Category/SelectedCategoriesNavbar"
import { Filter as FilterIcon } from "../components/Icon/Filter"
import Navigation, { NavigationTab } from "../components/Layout/Navigation"
import NoResults from "../components/Layout/NoResults"
import OverviewList from "../components/Layout/OverviewList"
import SearchInput from "../components/Layout/SearchInput"
import { CategoryModal } from "../components/Modal/CategoryModal"
import PlaceList from "../components/Place/PlaceList/PlaceList"
import { TrackingPlacesSearchContext } from "../context/TrackingContext"
import { CategoryCountTargetOptions } from "../entities/Category/types"
import { getPlaceListQuerySchema } from "../entities/Place/schemas"
import {
  AggregatePlaceAttributes,
  PlaceListOrderBy,
} from "../entities/Place/types"
import useEntitiesManager from "../hooks/useEntitiesManager"
import usePlaceCategoriesManager from "../hooks/usePlaceCategoriesManager"
import { FeatureFlags } from "../modules/ff"
import locations, {
  PlacesPageOptions,
  toPlacesOptions,
} from "../modules/locations"
import { SegmentPlace } from "../modules/segment"

import "./genesis.css"

const PAGE_SIZE = 24

export default function IndexPage() {
  const l = useFormatMessage()
  const isMobile = useMobileMediaQuery()
  const location = useLocation()
  const track = useTrackContext()
  const [, setTrackingId] = useContext(TrackingPlacesSearchContext)

  const [showBanner, setShowBanner] = useState(true)

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

  const {
    categories,
    previousActiveCategories,
    categoriesStack,
    isFilteringByCategory,
    handleAddCategory,
    handleRemoveCategory,
    handleSyncCategory,
  } = usePlaceCategoriesManager(
    CategoryCountTargetOptions.PLACES,
    params.categories
  )

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
      const categoriesFetch = params.categories.map((category) => {
        return Places.get().getPlaces({
          ...options,
          offset,
          limit: 15,
          categories: [category],
          search: isSearching ? search : undefined,
        })
      })
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
      const newTrackingId = crypto.randomUUID()
      setTrackingId(newTrackingId as string)
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
    }

    if (isSearching) {
      setAllPlaces(response.data)
    } else {
      if (params.only_view_category) {
        setAllPlaces(response.data)
      } else {
        setAllPlaces((allPlaces) => {
          const newPlaces = [...allPlaces, ...response.data]
          // each category is singly requested, a same place can appear on more than one category
          return unique(newPlaces, (place) => place.id)
        })
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
    useEntitiesManager(placesMemo)

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
    (
      _: React.MouseEvent<HTMLDivElement, MouseEvent>,
      props: { value?: any }
    ) => {
      const value =
        oneOf(props.value, getPlaceListQuerySchema.properties.order_by.enum) ??
        PlaceListOrderBy.LIKE_SCORE_BEST
      if (params.order_by !== value) {
        const newParams = { ...params, order_by: value, page: 1 }
        setAllPlaces([])

        navigate(locations.genesis(newParams))
      }
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
        newParams.order_by = PlaceListOrderBy.LIKE_SCORE_BEST
      } else {
        newParams.search = ""
        newParams.order_by = PlaceListOrderBy.MOST_ACTIVE
      }

      setAllPlaces([])
      navigate(locations.genesis(newParams))
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
      navigate(locations.genesis(newParams))
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
      navigate(locations.genesis(newParams))
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
            <Grid.Column id="column-filters">
              <CategoryList
                onChange={handleApplyCategoryListChange}
                categories={categories}
                label={l("social.places.title")}
              />
            </Grid.Column>
          )}
          <Grid.Column
            className={TokenList.join([
              "places-page__list",
              params.only_view_category && "full",
            ])}
            id="column-places-list"
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
                <SelectedCategoriesNavbar
                  categories={categories}
                  onChangeFilters={handleApplyCategoryListChange}
                  onClickClearAll={handleClearAll}
                />
              )}
              {params.only_view_category && (
                <OnlyViewCategoryNavbar
                  onClickBack={() => toggleViewAllCategory(null, true)}
                  onClickCategoryFilter={() =>
                    toggleViewAllCategory(null, false)
                  }
                  category={params.only_view_category}
                />
              )}
            </div>
            {showBanner &&
              (isMobile ? (
                <BannerMobile
                  type={CategoryCountTargetOptions.PLACES}
                  onClose={() => setShowBanner(false)}
                />
              ) : (
                <Banner
                  type={CategoryCountTargetOptions.PLACES}
                  onClose={() => setShowBanner(false)}
                />
              ))}
            {allPlaces.length > 0 &&
              (!isFilteringByCategory || params.only_view_category) && (
                <PlaceList
                  places={places}
                  onClickFavorite={(_, place) =>
                    handleFavorite(place.id, place)
                  }
                  loadingFavorites={handlingFavorite}
                  dataPlace={SegmentPlace.Places}
                />
              )}
            {isFilteringByCategory &&
              !params.only_view_category &&
              categoriesStack.map((category) => {
                const categorizedPlaces = places.filter((place) =>
                  place.categories.includes(category.name)
                )

                if (categorizedPlaces.length > 0) {
                  return (
                    <OverviewList
                      key={category.name}
                      title={
                        <>
                          {l(`categories.${category.name}`)}{" "}
                          <span>{category.count}</span>
                        </>
                      }
                      places={categorizedPlaces}
                      onClick={() => toggleViewAllCategory(category.name)}
                      loadingFavorites={handlingFavorite}
                      search={search}
                      dataPlace={SegmentPlace.Places}
                      onClickFavorite={(_, place) => {
                        handleFavorite(place.id, place)
                      }}
                      loading={loadingPlaces}
                    />
                  )
                }
              })}
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
