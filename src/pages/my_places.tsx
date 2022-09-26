import React from "react"

import { Helmet } from "react-helmet"

import Title from "decentraland-gatsby/dist/components/Text/Title"
import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useAsyncTask from "decentraland-gatsby/dist/hooks/useAsyncTask"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Container } from "decentraland-ui/dist/components/Container/Container"

import Places from "../api/Places"
import Navigation, { NavigationTab } from "../components/Layout/Navigation"
import PlaceList from "../components/Place/PlaceList/PlaceList"
import { AggregatePlaceAttributes } from "../entities/Place/types"
import { usePlaceListMyFavorites } from "../hooks/Place"
import { updatePlaceInPlaceList } from "../modules/arrays"

import "./my_places.css"

export default function PlacesPage() {
  const l = useFormatMessage()

  const [account, accountState] = useAuthContext()
  const [placeListMyFavorites, placeListMyFavoritesState] =
    usePlaceListMyFavorites()

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
          if (placeListMyFavorites && placeListMyFavorites.length > 0) {
            if (place.user_favorite && placeListMyFavorites) {
              placeListMyFavoritesState.set(
                updatePlaceInPlaceList(
                  placeListMyFavorites,
                  place.id,
                  favoritesResponse
                )
              )
            }
          }
        }
      }
    },
    [account]
  )
  return (
    <>
      <Helmet>
        <title>{l("social.my_places.title") || ""}</title>
        <meta
          name="description"
          content={l("social.my_places.description") || ""}
        />

        <meta property="og:title" content={l("social.my_places.title") || ""} />
        <meta
          property="og:description"
          content={l("social.my_places.description") || ""}
        />
        <meta property="og:image" content={l("social.my_places.image") || ""} />
        <meta property="og:site" content={l("social.my_places.site") || ""} />

        <meta
          name="twitter:title"
          content={l("social.my_places.title") || ""}
        />
        <meta
          name="twitter:description"
          content={l("social.my_places.description") || ""}
        />
        <meta
          name="twitter:image"
          content={l("social.my_places.image") || ""}
        />
        <meta name="twitter:card" content={l("social.my_places.card") || ""} />
        <meta
          name="twitter:creator"
          content={l("social.my_places.creator") || ""}
        />
        <meta name="twitter:site" content={l("social.my_places.site") || ""} />
      </Helmet>
      <Container className="full">
        <Navigation activeTab={NavigationTab.MyPlaces} />
        <Title>{l("pages.my_places.title")}</Title>
        <Title small>{l("pages.my_places.favorites")}</Title>
        <PlaceList
          places={placeListMyFavorites || []}
          onClickFavorite={handleFavorite}
          loading={placeListMyFavoritesState.loading}
          className="my-places-list__place-list"
        />
      </Container>
    </>
  )
}
