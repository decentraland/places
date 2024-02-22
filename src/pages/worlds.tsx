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
import { Back } from "decentraland-ui/dist/components/Back/Back"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import { Dropdown } from "decentraland-ui/dist/components/Dropdown/Dropdown"
import { HeaderMenu } from "decentraland-ui/dist/components/HeaderMenu/HeaderMenu"
import { useMobileMediaQuery } from "decentraland-ui/dist/components/Media/Media"
import { unique } from "radash"
import Grid from "semantic-ui-react/dist/commonjs/collections/Grid"

import Places from "../api/Places"
import Banner from "../components/Banner"
import BannerMobile from "../components/BannerMobile"
import {
  CategoryFilter,
  CategoryFilterProps,
} from "../components/Category/CategoryFilter"
import { CategoryList } from "../components/Category/CategoryList"
import SelectedCategoriesNavbar from "../components/Category/SelectedCategoriesNavbar"
import { Close } from "../components/Icon/Close"
import { Filter } from "../components/Icon/Filter"
import Navigation, { NavigationTab } from "../components/Layout/Navigation"
import NoResults from "../components/Layout/NoResults"
import OverviewList from "../components/Layout/OverviewList"
import SearchInput from "../components/Layout/SearchInput"
import { CategoryModal } from "../components/Modal/CategoryModal"
import PlaceList from "../components/Place/PlaceList/PlaceList"
import { TrackingPlacesSearchContext } from "../context/TrackingContext"
import { CategoryCountTargetOptions } from "../entities/Category/types"
import { AggregatePlaceAttributes } from "../entities/Place/types"
import { getWorldListQuerySchema } from "../entities/World/schemas"
import { WorldListOrderBy } from "../entities/World/types"
import usePlaceCategoriesManager from "../hooks/usePlaceCategoriesManager"
import usePlacesManager from "../hooks/usePlacesManager"
import { FeatureFlags } from "../modules/ff"
import locations, {
  WorldsPageOptions,
  toWorldsOptions,
} from "../modules/locations"
import { SegmentPlace } from "../modules/segment"

import "./worlds.css"

const PAGE_SIZE = 24

export default function WorldsPage() {
  const l = useFormatMessage()
  const isMobile = useMobileMediaQuery()
  const location = useLocation()
  const track = useTrackContext()
  const params = useMemo(
    () => toWorldsOptions(new URLSearchParams(location.search)),
    [location.search]
  )
  const [offset, setOffset] = useState(0)

  const isSearching = !!params.search && params.search.length > 2
  const search = (isSearching && params.search) || ""

  const [showBanner, setShowBanner] = useState(true)

  const [totalWorlds, setTotalWorlds] = useState(0)
  const [allWorlds, setAllWorlds] = useState<AggregatePlaceAttributes[]>([])

  const [isCategoriesModalVisible, setIsCategoriesModalVisible] =
    useState(false)

  const {
    categories,
    previousActiveCategories,
    categoriesStack,
    isFilteringByCategory,
    handleAddCategory,
    handleRemoveCategory,
    handleSyncCategory,
  } = usePlaceCategoriesManager("worlds", params.categories)

  const [, setTrackingId] = useContext(TrackingPlacesSearchContext)

  const [loadingWorlds, loadWorlds] = useAsyncTask(async () => {
    const options: Partial<WorldsPageOptions> = API.fromPagination(params, {
      pageSize: PAGE_SIZE,
    })

    let response = {
      total: 0,
      data: [] as AggregatePlaceAttributes[],
      ok: false,
    }

    if (params.only_view_category) {
      const placesFetch = await Places.get().getWorlds({
        ...options,
        offset: offset,
        search: isSearching ? search : undefined,
        categories: [params.only_view_category],
      })
      response.data = placesFetch.data
      response.ok = placesFetch.ok
      response.total = placesFetch.total
    }

    if (isFilteringByCategory && !params.only_view_category) {
      const categoriesFetch = params.categories.map((category) => {
        return Places.get().getWorlds({
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
      const placesFetch = await Places.get().getWorlds({
        ...options,
        offset,
        search: isSearching ? search : undefined,
      })
      response = placesFetch
    }

    if (isFilteringByCategory || isSearching || params.only_view_category) {
      const newTrackingId = crypto.randomUUID()
      setTrackingId(newTrackingId as string)
      track(SegmentPlace.WorldsSearch, {
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
        place: SegmentPlace.Worlds,
      })
    }

    if (isSearching) {
      setAllWorlds(response.data)
    } else {
      if (params.only_view_category) {
        setAllWorlds(response.data)
      } else {
        setAllWorlds((allWorlds) => {
          const newWorlds = [...allWorlds, ...response.data]
          // each category is singly requested, a same world can appear on more than one category
          return unique(newWorlds, (world) => world.id)
        })
      }
    }
    if (Number.isSafeInteger(response.total)) {
      setTotalWorlds(response.total)
    }
  }, [params, track])

  useEffect(() => {
    if (allWorlds.length === 0) {
      loadWorlds()
    }
  }, [params.only_favorites, params.order, params.order_by, params.categories])

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
    params.categories,
  ])

  useEffect(() => {
    if (
      allWorlds.length > PAGE_SIZE &&
      !isFilteringByCategory &&
      !params.only_view_category
    ) {
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

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newParams: Partial<WorldsPageOptions> = {
        ...params,
      }

      if (e.target.value) {
        newParams.search = e.target.value
      } else {
        newParams.search = ""
      }

      setAllWorlds([])
      navigate(locations.worlds(newParams))
    },
    [params]
  )

  const handleChangeOrder = useCallback(
    (
      _: React.MouseEvent<HTMLDivElement, MouseEvent>,
      props: { value?: any }
    ) => {
      const value =
        oneOf(props.value, getWorldListQuerySchema.properties.order_by.enum) ??
        WorldListOrderBy.LIKE_SCORE_BEST
      const newParams = { ...params, order_by: value, page: 1 }
      setAllWorlds([])

      navigate(locations.worlds(newParams))
    },
    [params, track]
  )

  const handleCategoriesFilterChange = useCallback(
    (newCategories: string[]) => {
      // change sorting when filter by categories
      const newParams: WorldsPageOptions = {
        ...params,
        categories: newCategories,
      }
      if (
        (!newParams.order_by ||
          newParams.order_by !== WorldListOrderBy.LIKE_SCORE_BEST) &&
        newCategories.length > 0
      ) {
        newParams.order_by = WorldListOrderBy.LIKE_SCORE_BEST
      } else if (!newCategories.length) {
        newParams.order_by = WorldListOrderBy.MOST_ACTIVE
      }

      setAllWorlds([])
      navigate(locations.worlds(newParams))
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

      setAllWorlds([])
      navigate(locations.worlds(newParams))
    },
    [params]
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
          {!isMobile && !params.only_view_category && (
            <Grid.Column id="column-filters">
              <CategoryList
                onChange={handleApplyCategoryListChange}
                categories={categories}
                isNew
                label={l("navigation.worlds")}
              />
            </Grid.Column>
          )}
          <Grid.Column
            // tablet={16}
            className={TokenList.join([
              "worlds-page__list",
              params.only_view_category && "full",
            ])}
            id="column-worlds-list"
          >
            {isMobile && (
              <div className="places-page__search-input--mobile">
                <SearchInput
                  placeholder={l(`navigation.search.${NavigationTab.Worlds}`)}
                  onChange={handleSearchChange}
                  defaultValue={params.search}
                />
              </div>
            )}
            {!isMobile && (
              <HeaderMenu stackable>
                <HeaderMenu.Left>
                  <SearchInput
                    placeholder={l(`navigation.search.${NavigationTab.Worlds}`)}
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
                      {getWorldListQuerySchema.properties.order_by.enum.map(
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
            <div className="worlds-page__category-filters-box-container">
              <div className="worlds-page__category-filters-info">
                <p>
                  {totalWorlds} {l("navigation.worlds")}
                </p>
                {isMobile && (
                  <div>
                    <Dropdown
                      text={l(`general.order_by.${params.order_by}`)}
                      direction="left"
                    >
                      <Dropdown.Menu>
                        {getWorldListQuerySchema.properties.order_by.enum.map(
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
                      content={<Filter width="20" height="18" />}
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
            {showBanner &&
              (isMobile ? (
                <BannerMobile
                  type={CategoryCountTargetOptions.WORLDS}
                  onClose={() => setShowBanner(false)}
                />
              ) : (
                <Banner
                  type={CategoryCountTargetOptions.WORLDS}
                  onClose={() => setShowBanner(false)}
                />
              ))}
            {allWorlds.length > 0 &&
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
                      dataPlace={SegmentPlace.Worlds}
                      onClickFavorite={(_, place) => {
                        handleFavorite(place.id, place)
                      }}
                      loading={loadingWorlds}
                    />
                  )
                }
              })}
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
            {!loading &&
              totalWorlds > places.length &&
              (!isFilteringByCategory || params.only_view_category) && (
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
