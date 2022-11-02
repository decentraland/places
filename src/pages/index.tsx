import React, { useMemo } from "react"

import { Helmet } from "react-helmet"

import Carousel2, {
  IndicatorsType,
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
import { usePlaceListHightRated } from "../hooks/usePlaceListHightRated"
import { usePlaceListMostActive } from "../hooks/usePlaceListMostActive"
import { usePlaceListMyFavorites } from "../hooks/usePlaceListMyFavorites"
import { usePlaceListPois } from "../hooks/usePlaceListPois"
import { usePlaceListRecentlyUpdates } from "../hooks/usePlaceListRecentlyUpdates"
import usePlacesManager from "../hooks/usePlacesManager"
import { FeatureFlags } from "../modules/ff"
import locations from "../modules/locations"
import { SegmentPlace } from "../modules/segment"

import "./index.css"

const overviewOptions = { limit: 5, offset: 0 }
const overviewPoisOptions = {
  limit: 5,
  offset: 0,
  positions: ["-119,125", "27,-118", "-38,103", "-85,60", "-75,108"],
}

export default function OverviewPage() {
  const l = useFormatMessage()

  const [account] = useAuthContext()
  const [placeListFeatured, placeListFeaturedState] = usePlaceListFeatured()
  const [placeListMostActive, placeListMostActiveState] =
    usePlaceListMostActive(overviewOptions)
  const [placeListLastUpdates, placeListLastUpdatesState] =
    usePlaceListRecentlyUpdates(overviewOptions)
  const [placeListHightRated, placeListHightRatedState] =
    usePlaceListHightRated(overviewOptions)
  const [placeListMyFavorites, placeListMyFavoritesState] =
    usePlaceListMyFavorites(overviewOptions)
  const [placeListPois, placeListPoisState] =
    usePlaceListPois(overviewPoisOptions)

  const placesMemo = useMemo(
    () => [
      placeListFeatured,
      placeListMostActive,
      placeListLastUpdates,
      placeListHightRated,
      placeListMyFavorites.data,
      placeListPois,
    ],
    [
      placeListFeatured,
      placeListMostActive,
      placeListLastUpdates,
      placeListHightRated,
      placeListMyFavorites,
      placeListPois,
    ]
  )

  const [
    [
      featuredList,
      mostActiveList,
      lastUpdatesList,
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

      {featuredList.length > 0 && !placeListFeaturedState.loading && (
        <Carousel2
          className="overview__carousel2"
          isFullscreen
          indicatorsType={IndicatorsType.Dash}
          items={featuredList}
          component={PlaceFeatured}
        />
      )}
      <Container className="full overview-container">
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
          loading={placeListMostActiveState.loading}
          loadingFavorites={handlingFavorite}
          dataPlace={SegmentPlace.OverviewMostActive}
        />
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
          loading={placeListHightRatedState.loading}
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
              loading={placeListMyFavoritesState.loading}
              loadingFavorites={handlingFavorite}
              dataPlace={SegmentPlace.OverviewMyFavorites}
            />
          )}
        <OverviewList
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
          loading={placeListLastUpdatesState.loading}
          loadingFavorites={handlingFavorite}
          dataPlace={SegmentPlace.OverviewRecentlyUpdated}
        />
        <OverviewList
          places={poisList}
          title={l("pages.overview.points_of_interest")}
          href={locations.places({ only_pois: true })}
          onClickFavorite={(e, place) =>
            handleFavorite(place.id, place, {
              place: e.currentTarget.dataset.place!,
            })
          }
          loading={placeListPoisState.loading}
          loadingFavorites={handlingFavorite}
          dataPlace={SegmentPlace.OverviewPointsOfInterest}
        />
      </Container>
    </>
  )
}
