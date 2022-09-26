import React from "react"

import { Helmet } from "react-helmet"

import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useAsyncTask from "decentraland-gatsby/dist/hooks/useAsyncTask"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Container } from "decentraland-ui/dist/components/Container/Container"
import { Hero } from "decentraland-ui/dist/components/Hero/Hero"

import Places from "../api/Places"
import Navigation, { NavigationTab } from "../components/Layout/Navigation"
import OverviewList from "../components/Layout/OverviewList"
import { AggregatePlaceAttributes } from "../entities/Place/types"
import {
  usePlaceListMyFavorites,
  usePlaceListPois,
  usePlaceListPopular,
  usePlaceListRecentlyUpdates,
} from "../hooks/Place"
import { updatePlaceInPlaceList } from "../modules/arrays"
import locations, { PlacesOrderBy } from "../modules/locations"

import "./index.css"

const overviewOptions = { limit: 5, offset: 0 }

export default function OverviewPage() {
  const l = useFormatMessage()

  const [account, accountState] = useAuthContext()
  const [placeListLastUpdates, placeListLastUpdatesState] =
    usePlaceListRecentlyUpdates(overviewOptions)
  const [placeListPopular, placeListPopularState] =
    usePlaceListPopular(overviewOptions)
  const [placeListMyFavorites, placeListMyFavoritesState] =
    usePlaceListMyFavorites(overviewOptions)
  const [placeListPois, placeListPoisState] = usePlaceListPois(overviewOptions)

  const [handlingFavorite, handleFavorite] = useAsyncTask(
    async (event, place: AggregatePlaceAttributes) => {
      if (account === null) {
        accountState.select()
      } else if (place) {
        const favoritesResponse = await Places.get().updateFavorite(
          place.id,
          !place.user_favorite
        )

        if (favoritesResponse) {
          placeListLastUpdatesState.set(
            updatePlaceInPlaceList(
              placeListLastUpdates,
              place.id,
              favoritesResponse
            )
          )

          placeListPopularState.set(
            updatePlaceInPlaceList(
              placeListPopular,
              place.id,
              favoritesResponse
            )
          )

          placeListPoisState.set(
            updatePlaceInPlaceList(placeListPois, place.id, favoritesResponse)
          )

          placeListMyFavoritesState.set(
            updatePlaceInPlaceList(
              placeListMyFavorites,
              place.id,
              favoritesResponse
            )
          )
        }
      }
    },
    [
      account,
      placeListLastUpdatesState,
      placeListPopularState,
      placeListPoisState,
      placeListMyFavorites,
    ]
  )

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
      <Hero>
        <Hero.Header>{l("pages.overview.title")}</Hero.Header>
        <Hero.Description>
          {l("pages.overview.search_the_metaverse")}
        </Hero.Description>
      </Hero>
      <Container className="full">
        <OverviewList
          places={placeListPopular || []}
          title={l("pages.overview.popular")}
          href={locations.places({
            order_by: PlacesOrderBy.Popularity,
          })}
          onClickFavorite={handleFavorite}
          loading={placeListPopularState.loading}
        />
        {account && placeListMyFavorites && placeListMyFavorites.length > 0 && (
          <OverviewList
            places={placeListMyFavorites || []}
            title={l("pages.overview.my_favorites")}
            href={locations.my_places()}
            onClickFavorite={handleFavorite}
            loading={placeListMyFavoritesState.loading}
          />
        )}
        <OverviewList
          places={placeListLastUpdates || []}
          title={l("pages.overview.recently_updated")}
          href={locations.places({
            order_by: PlacesOrderBy.UpdatedAt,
          })}
          onClickFavorite={handleFavorite}
          loading={placeListLastUpdatesState.loading}
        />
        <OverviewList
          places={placeListPois || []}
          title={l("pages.overview.points_of_interest")}
          href={locations.places({})}
          onClickFavorite={handleFavorite}
          loading={placeListPoisState.loading}
        />
      </Container>
    </>
  )
}
