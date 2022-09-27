import React, { useMemo } from "react"

import { Helmet } from "react-helmet"

import Title from "decentraland-gatsby/dist/components/Text/Title"
import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Container } from "decentraland-ui/dist/components/Container/Container"
import { Hero } from "decentraland-ui/dist/components/Hero/Hero"
import { SignIn } from "decentraland-ui/dist/components/SignIn/SignIn"

import Navigation, { NavigationTab } from "../components/Layout/Navigation"
import PlaceList from "../components/Place/PlaceList/PlaceList"
import { usePlaceListMyFavorites } from "../hooks/usePlaceListMyFavorites"
import usePlacesManager from "../hooks/usePlacesManager"

import "./my_places.css"

export default function PlacesPage() {
  const l = useFormatMessage()
  const [account, accountState] = useAuthContext()

  const [placeListMyFavorites, placeListMyFavoritesState] =
    usePlaceListMyFavorites()

  const placesMemo = useMemo(
    () => [placeListMyFavorites],
    [placeListMyFavorites]
  )

  const [[myFavoritesList], { handleFavorite, handlingFavorite }] =
    usePlacesManager(placesMemo)

  if (!account || accountState.loading) {
    return (
      <>
        <Helmet>
          <title>{l("social.my_places.title") || ""}</title>
          <meta
            name="description"
            content={l("social.my_places.description") || ""}
          />

          <meta
            property="og:title"
            content={l("social.my_places.title") || ""}
          />
          <meta
            property="og:description"
            content={l("social.my_places.description") || ""}
          />
          <meta
            property="og:image"
            content={l("social.my_places.image") || ""}
          />
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
          <meta
            name="twitter:card"
            content={l("social.my_places.card") || ""}
          />
          <meta
            name="twitter:creator"
            content={l("social.my_places.creator") || ""}
          />
          <meta
            name="twitter:site"
            content={l("social.my_places.site") || ""}
          />
        </Helmet>
        <Navigation activeTab={NavigationTab.MyPlaces} />
        <Container className="my-places-list__sign-in">
          <SignIn
            isConnecting={accountState.loading}
            onConnect={() => accountState.select()}
          />
        </Container>
      </>
    )
  }

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
      <Navigation activeTab={NavigationTab.MyPlaces} />
      <Hero className="my-places-list__title">
        <Hero.Header>{l("pages.my_places.title")}</Hero.Header>
      </Hero>
      <Container className="my-places-list__container">
        <Title small>{l("pages.my_places.favorites")}</Title>
        <PlaceList
          places={myFavoritesList || []}
          onClickFavorite={(_, place) => handleFavorite(place.id, place)}
          loading={placeListMyFavoritesState.loading}
          className="my-places-list__place-list"
          loadingFavorites={handlingFavorite}
        />
      </Container>
    </>
  )
}
