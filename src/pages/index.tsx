/* eslint-disable import/order */
import React, { useEffect, useMemo, useState } from "react"

import { Helmet } from "react-helmet"

import Carousel2, {
  IndicatorType,
} from "decentraland-gatsby/dist/components/Carousel2/Carousel2"
import MaintenancePage from "decentraland-gatsby/dist/components/Layout/MaintenancePage"
import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useFeatureFlagContext from "decentraland-gatsby/dist/context/FeatureFlag/useFeatureFlagContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Container } from "decentraland-ui/dist/components/Container/Container"

import Navigation, { NavigationTab } from "../components/Layout/Navigation"
import OverviewList from "../components/Layout/OverviewList"
import PlaceFeatured from "../components/Place/PlaceFeatured/PlaceFeatured"
import { PlaceListOrderBy } from "../entities/Place/types"
import { usePlaceListFeatured } from "../hooks/usePlaceListFeatured"
import { usePlaceListHighlighted } from "../hooks/usePlaceListHighlighted"
import { usePlaceListHightRated } from "../hooks/usePlaceListHightRated"
import { usePlaceListMostActive } from "../hooks/usePlaceListMostActive"
import { usePlaceListMyFavorites } from "../hooks/usePlaceListMyFavorites"
import { usePlaceListPois } from "../hooks/usePlaceListPois"
/* import { usePlaceListRecentlyUpdates } from "../hooks/usePlaceListRecentlyUpdates" */
import usePlacesManager from "../hooks/usePlacesManager"
import { useUserHasUsedWorld } from "../hooks/useUserHasUsedWorld"
import { FeatureFlags } from "../modules/ff"
import locations from "../modules/locations"
import { SegmentPlace } from "../modules/segment"

import { useGetCategories } from "../hooks/getCategories"
import CategoryList from "../components/Layout/CategoryList"
import { useGetCategoryFromId } from "../hooks/useGetCategortFromId"
import { useGetRecommendations } from "../hooks/useGetRecomendations"
import RecommendationList from "../components/Layout/RecommendationList"

import "./index.css"

const overviewOptions = { limit: 24, offset: 0 }

export default function OverviewPage() {
  const l = useFormatMessage()
  const [account] = useAuthContext()

  // const hasUserUsedTheWorld = true
  // //todo: esto va asi
  const hasUserUsedTheWorld = useUserHasUsedWorld()
  const [categories] = useGetCategories()
  const [recommendations] = useGetRecommendations()

  const [placeListHighlighted, placeListHighlightedState] =
    usePlaceListHighlighted()
  const [placeListFeatured, placeListFeaturedState] = usePlaceListFeatured()
  const [placeListMostActive, placeListMostActiveState] =
    usePlaceListMostActive(overviewOptions)
  /* const [placeListLastUpdates, placeListLastUpdatesState] =
    usePlaceListRecentlyUpdates(overviewOptions) */
  const [placeListHightRated, placeListHightRatedState] =
    usePlaceListHightRated(overviewOptions)
  const [placeListMyFavorites, placeListMyFavoritesState] =
    usePlaceListMyFavorites(overviewOptions)
  const [placeListPois, placeListPoisState] = usePlaceListPois(overviewOptions)

  const placesMemo = useMemo(
    () => [
      placeListHighlighted,
      placeListFeatured,
      placeListMostActive,
      placeListHightRated,
      placeListMyFavorites.data,
      placeListPois,
    ],
    [
      placeListHighlighted,
      placeListFeatured,
      placeListMostActive,
      placeListHightRated,
      placeListMyFavorites,
      placeListPois,
    ]
  )

  const [
    [
      highlightedList,
      featuredList,
      mostActiveList,
      hightRatedList,
      myFavoritesList,
      poisList,
    ],
    { handleFavorite, handlingFavorite },
  ] = usePlacesManager(placesMemo)

  const [ff] = useFeatureFlagContext()

  if (ff.flags[FeatureFlags.Maintenance]) {
    return <MaintenancePage />
  }

  return (
    <>
      <Helmet>
        <title>{l("social.home.title") || ""}</title>
        <meta name="description" content={l("social.home.description") || ""} />

        <meta property="og:title" content={l("social.home.title") || ""} />
        <meta
          property="og:description"
          content={l("social.home.description") || ""}
        />
        <meta property="og:image" content={l("social.home.image") || ""} />
        <meta property="og:site" content={l("social.home.site") || ""} />

        <meta name="twitter:title" content={l("social.home.title") || ""} />
        <meta
          name="twitter:description"
          content={l("social.home.description") || ""}
        />
        <meta name="twitter:image" content={l("social.home.image") || ""} />
        <meta name="twitter:card" content={l("social.home.card") || ""} />
        <meta name="twitter:creator" content={l("social.home.creator") || ""} />
        <meta name="twitter:site" content={l("social.home.site") || ""} />
      </Helmet>
      <Navigation activeTab={NavigationTab.Overview} />

      {(placeListHighlightedState.loading || highlightedList.length > 0) && (
        <Carousel2
          className="overview__carousel2"
          loading={placeListHighlightedState.loading}
          isFullscreen
          indicatorsType={IndicatorType.Dash}
          items={highlightedList}
          component={PlaceFeatured}
        />
      )}
      <Container className="full overview-container">
        <CategoryList categories={categories} />
        {account && hasUserUsedTheWorld ? (
          <RecommendationList recommendations={recommendations} />
        ) : null}
        <OverviewList
          places={mostActiveList}
          title={l("pages.overview.most_active")}
          href={locations.places({
            order_by: PlaceListOrderBy.MOST_ACTIVE,
          })}
          onClickFavorite={(e, place) =>
            handleFavorite(place.id, place, {
              place: e.currentTarget.dataset.place!,
            })
          }
          loading={
            placeListMostActiveState.version === 0 ||
            placeListMostActiveState.loading
          }
          loadingFavorites={handlingFavorite}
          dataPlace={SegmentPlace.OverviewMostActive}
        />
        {featuredList.length > 0 && (
          <OverviewList
            places={featuredList}
            title={l("pages.overview.featured")}
            href={locations.places({
              only_featured: true,
            })}
            onClickFavorite={(e, place) =>
              handleFavorite(place.id, place, {
                place: e.currentTarget.dataset.place!,
              })
            }
            loading={
              placeListFeaturedState.version === 0 ||
              placeListFeaturedState.loading
            }
            loadingFavorites={handlingFavorite}
            dataPlace={SegmentPlace.OverviewFeatured}
          />
        )}
        <OverviewList
          places={hightRatedList}
          title={l("pages.overview.highest_rated")}
          href={locations.places({
            order_by: PlaceListOrderBy.HIGHEST_RATED,
          })}
          onClickFavorite={(e, place) =>
            handleFavorite(place.id, place, {
              place: e.currentTarget.dataset.place!,
            })
          }
          loading={
            placeListHightRatedState.version === 0 ||
            placeListHightRatedState.loading
          }
          loadingFavorites={handlingFavorite}
          dataPlace={SegmentPlace.OverviewHightRated}
        />
        {account &&
          placeListMyFavorites &&
          placeListMyFavorites.data.length > 0 && (
            <OverviewList
              places={myFavoritesList}
              title={l("pages.overview.my_favorites")}
              href={locations.my_places({})}
              onClickFavorite={(e, place) =>
                handleFavorite(place.id, place, {
                  place: e.currentTarget.dataset.place!,
                })
              }
              loading={
                placeListMyFavoritesState.version === 0 ||
                placeListMyFavoritesState.loading
              }
              loadingFavorites={handlingFavorite}
              dataPlace={SegmentPlace.OverviewMyFavorites}
            />
          )}
        {/* <OverviewList
          places={lastUpdatesList}
          title={l("pages.overview.recently_updated")}
          href={locations.places({
            order_by: PlaceListOrderBy.UPDATED_AT,
          })}
          onClickFavorite={(e, place) =>
            handleFavorite(place.id, place, {
              place: e.currentTarget.dataset.place!,
            })
          }
          loading={
            placeListLastUpdatesState.version === 0 ||
            placeListLastUpdatesState.loading
          }
          loadingFavorites={handlingFavorite}
          dataPlace={SegmentPlace.OverviewRecentlyUpdated}
        /> */}
        <OverviewList
          places={poisList}
          title={l("pages.overview.points_of_interest")}
          href={locations.places({ only_pois: true })}
          onClickFavorite={(e, place) =>
            handleFavorite(place.id, place, {
              place: e.currentTarget.dataset.place!,
            })
          }
          loading={
            placeListPoisState.version === 0 || placeListPoisState.loading
          }
          loadingFavorites={handlingFavorite}
          dataPlace={SegmentPlace.OverviewPointsOfInterest}
        />
      </Container>
    </>
  )
}
