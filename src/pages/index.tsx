import React, { useMemo } from "react"

import { Helmet } from "react-helmet"

import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Container } from "decentraland-ui/dist/components/Container/Container"

import Navigation, { NavigationTab } from "../components/Layout/Navigation"
import OverviewList from "../components/Layout/OverviewList"
import { PlaceListOrderBy } from "../entities/Place/types"
import { usePlaceListMyFavorites } from "../hooks/usePlaceListMyFavorites"
import { usePlaceListPois } from "../hooks/usePlaceListPois"
import { usePlaceListPopular } from "../hooks/usePlaceListPopular"
import { usePlaceListRecentlyUpdates } from "../hooks/usePlaceListRecentlyUpdates"
import usePlacesManager from "../hooks/usePlacesManager"
import locations from "../modules/locations"

import "./index.css"

const overviewOptions = { limit: 5, offset: 0 }

export default function OverviewPage() {
  const l = useFormatMessage()

  const [account] = useAuthContext()
  const [placeListLastUpdates, placeListLastUpdatesState] =
    usePlaceListRecentlyUpdates(overviewOptions)
  const [placeListPopular, placeListPopularState] =
    usePlaceListPopular(overviewOptions)
  const [placeListMyFavorites, placeListMyFavoritesState] =
    usePlaceListMyFavorites(overviewOptions)
  const [placeListPois, placeListPoisState] = usePlaceListPois(overviewOptions)

  const placesMemo = useMemo(
    () => [
      placeListLastUpdates,
      placeListPopular,
      placeListMyFavorites.data,
      placeListPois,
    ],
    [
      placeListLastUpdates,
      placeListPopular,
      placeListMyFavorites,
      placeListPois,
    ]
  )

  const [
    [lastUpdatesList, popularList, myFavoritesList, poisList],
    { handleFavorite, handlingFavorite },
  ] = usePlacesManager(placesMemo)

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
      <Container className="full overview-container">
        <OverviewList
          places={popularList}
          title={l("pages.overview.popular")}
          href={locations.places({
            order_by: PlaceListOrderBy.POPULARITY,
          })}
          onClickFavorite={(_, place) => handleFavorite(place.id, place)}
          loading={placeListPopularState.loading}
          loadingFavorites={handlingFavorite}
        />
        {account &&
          placeListMyFavorites &&
          placeListMyFavorites.data.length > 0 && (
            <OverviewList
              places={myFavoritesList}
              title={l("pages.overview.my_favorites")}
              href={locations.my_places({})}
              onClickFavorite={(_, place) => handleFavorite(place.id, place)}
              loading={placeListMyFavoritesState.loading}
              loadingFavorites={handlingFavorite}
            />
          )}
        <OverviewList
          places={lastUpdatesList}
          title={l("pages.overview.recently_updated")}
          href={locations.places({
            order_by: PlaceListOrderBy.UPDATED_AT,
          })}
          onClickFavorite={(_, place) => handleFavorite(place.id, place)}
          loading={placeListLastUpdatesState.loading}
          loadingFavorites={handlingFavorite}
        />
        <OverviewList
          places={poisList}
          title={l("pages.overview.points_of_interest")}
          href={locations.places({ only_pois: true })}
          onClickFavorite={(_, place) => handleFavorite(place.id, place)}
          loading={placeListPoisState.loading}
          loadingFavorites={handlingFavorite}
        />
      </Container>
    </>
  )
}
