import React, { useMemo } from "react"

import { Helmet } from "react-helmet"

import Carousel2, {
  IndicatorType,
} from "decentraland-gatsby/dist/components/Carousel2/Carousel2"
import MaintenancePage from "decentraland-gatsby/dist/components/Layout/MaintenancePage"
import Paragraph from "decentraland-gatsby/dist/components/Text/Paragraph"
import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useFeatureFlagContext from "decentraland-gatsby/dist/context/FeatureFlag/useFeatureFlagContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Link } from "decentraland-gatsby/dist/plugins/intl"
import { Button } from "decentraland-ui/dist/components/Button/Button"
import { Container } from "decentraland-ui/dist/components/Container/Container"
import { Header } from "decentraland-ui/dist/components/Header/Header"
import { HeaderMenu } from "decentraland-ui/dist/components/HeaderMenu/HeaderMenu"
import { SignIn } from "decentraland-ui/dist/components/SignIn/SignIn"
import { cluster } from "radash/dist/array"
import Icon from "semantic-ui-react/dist/commonjs/elements/Icon"

import Navigation, { NavigationTab } from "../../components/Layout/Navigation"
import PlaceCard from "../../components/Place/PlaceCard/PlaceCard"
import { AggregatePlaceAttributes } from "../../entities/Place/types"
import useCardsByWidth from "../../hooks/useCardsByWidth"
import { usePlaceListMyFavorites } from "../../hooks/usePlaceListMyFavorites"
import usePlacesManager from "../../hooks/usePlacesManager"
import { useWorldListMyFavorites } from "../../hooks/useWorldListMyFavorites"
import { FeatureFlags } from "../../modules/ff"
import locations from "../../modules/locations"
import { SegmentPlace } from "../../modules/segment"

import "./favorites.css"

const PAGE_SIZE = 24

export default function FavoritesPage() {
  const l = useFormatMessage()
  const [account, accountState] = useAuthContext()

  const options = useMemo(() => ({ limit: PAGE_SIZE, offset: 0 }), [])

  const [placeListMyFavorites, placeListMyFavoritesState] =
    usePlaceListMyFavorites(options)
  const [worldListMyFavorites, worldListMyFavoritesState] =
    useWorldListMyFavorites(options)

  const placesMemo = useMemo(
    () => [placeListMyFavorites.data, worldListMyFavorites.data],
    [placeListMyFavorites.data, worldListMyFavorites.data]
  )

  const [
    [placeFavoriteList, worldFavoriteList],
    { handleFavorite, handlingFavorite },
  ] = usePlacesManager(placesMemo)

  const [ff] = useFeatureFlagContext()

  if (ff.flags[FeatureFlags.Maintenance]) {
    return <MaintenancePage />
  }

  const cardsToShow = useCardsByWidth({
    cardWidth: 300,
    cardMargin: 14,
    containerMargin: 48,
  })

  if (!account || accountState.loading) {
    return (
      <>
        <Helmet>
          <title>{l("social.favorites.title") || ""}</title>
          <meta
            name="description"
            content={l("social.favorites.description") || ""}
          />

          <meta
            property="og:title"
            content={l("social.favorites.title") || ""}
          />
          <meta
            property="og:description"
            content={l("social.favorites.description") || ""}
          />
          <meta
            property="og:image"
            content={l("social.favorites.image") || ""}
          />
          <meta property="og:site" content={l("social.favorites.site") || ""} />

          <meta
            name="twitter:title"
            content={l("social.favorites.title") || ""}
          />
          <meta
            name="twitter:description"
            content={l("social.favorites.description") || ""}
          />
          <meta
            name="twitter:image"
            content={l("social.favorites.image") || ""}
          />
          <meta
            name="twitter:card"
            content={l("social.favorites.card") || ""}
          />
          <meta
            name="twitter:creator"
            content={l("social.favorites.creator") || ""}
          />
          <meta
            name="twitter:site"
            content={l("social.favorites.site") || ""}
          />
        </Helmet>
        <Navigation activeTab={NavigationTab.Favorites} />
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
        <title>{l("social.favorites.title") || ""}</title>
        <meta
          name="description"
          content={l("social.favorites.description") || ""}
        />

        <meta property="og:title" content={l("social.favorites.title") || ""} />
        <meta
          property="og:description"
          content={l("social.favorites.description") || ""}
        />
        <meta property="og:image" content={l("social.favorites.image") || ""} />
        <meta property="og:site" content={l("social.favorites.site") || ""} />

        <meta
          name="twitter:title"
          content={l("social.favorites.title") || ""}
        />
        <meta
          name="twitter:description"
          content={l("social.favorites.description") || ""}
        />
        <meta
          name="twitter:image"
          content={l("social.favorites.image") || ""}
        />
        <meta name="twitter:card" content={l("social.favorites.card") || ""} />
        <meta
          name="twitter:creator"
          content={l("social.favorites.creator") || ""}
        />
        <meta name="twitter:site" content={l("social.favorites.site") || ""} />
      </Helmet>
      <Navigation activeTab={NavigationTab.Favorites} />
      <div className="favorites__list">
        <Container className="full">
          <HeaderMenu>
            <HeaderMenu.Left>
              <Header>{l("pages.favorites.places")}</Header>
            </HeaderMenu.Left>
            <HeaderMenu.Right>
              <Button basic as={Link} href={locations.favoritesPlaces({})}>
                {l("components.overview_list.view_all")}
                <Icon name="chevron right" />
              </Button>
            </HeaderMenu.Right>
          </HeaderMenu>
        </Container>
        {!accountState.loading && placeFavoriteList.length > 0 && (
          <Container className="full">
            <Carousel2
              className="favorites__carousel"
              indicatorsType={IndicatorType.Dash}
              dynamicBullets={true}
              items={cluster(placeFavoriteList, cardsToShow)}
              progress
              component={(props) => (
                <div className="favorites__item-container">
                  {props.item?.map((item: AggregatePlaceAttributes) => {
                    return (
                      <PlaceCard
                        key={item?.id}
                        place={item}
                        loading={
                          placeListMyFavoritesState.version === 0 ||
                          placeListMyFavoritesState.loading
                        }
                        onClickFavorite={(e, place) =>
                          handleFavorite(place.id, place, {
                            place: e.currentTarget.dataset.place!,
                          })
                        }
                        dataPlace={SegmentPlace.FavoritesPlaces}
                        loadingFavorites={
                          item?.id ? handlingFavorite?.has(item.id) : false
                        }
                      />
                    )
                  })}
                </div>
              )}
            />
          </Container>
        )}

        {!accountState.loading && placeFavoriteList.length === 0 && (
          <Container className="favorites-list__empty">
            <Paragraph secondary>
              {l("pages.favorites.no_favorite_selected")}
              <br />
              <Link href={locations.places({})}>
                {l("pages.favorites.go_to_places")}
              </Link>
              .
            </Paragraph>
          </Container>
        )}
      </div>
      {!ff.flags[FeatureFlags.HideWorlds] && (
        <div className="favorites__list">
          <Container className="full">
            <HeaderMenu>
              <HeaderMenu.Left>
                <Header>{l("pages.favorites.worlds")}</Header>
              </HeaderMenu.Left>
              <HeaderMenu.Right>
                <Button basic as={Link} href={locations.favoritesWorlds({})}>
                  {l("components.overview_list.view_all")}
                  <Icon name="chevron right" />
                </Button>
              </HeaderMenu.Right>
            </HeaderMenu>
          </Container>
          {!accountState.loading && worldFavoriteList.length > 0 && (
            <Container className="full">
              <Carousel2
                className="favorites__carousel"
                indicatorsType={IndicatorType.Dash}
                dynamicBullets={true}
                items={cluster(worldFavoriteList, cardsToShow)}
                progress
                component={(props) => (
                  <div className="favorites__item-container">
                    {props.item?.map((item: AggregatePlaceAttributes) => {
                      return (
                        <PlaceCard
                          key={item?.id}
                          place={item}
                          loading={
                            worldListMyFavoritesState.version === 0 ||
                            worldListMyFavoritesState.loading
                          }
                          onClickFavorite={(e, place) =>
                            handleFavorite(place.id, place, {
                              place: e.currentTarget.dataset.place!,
                            })
                          }
                          dataPlace={SegmentPlace.FavoritesPlaces}
                          loadingFavorites={
                            item?.id ? handlingFavorite?.has(item.id) : false
                          }
                        />
                      )
                    })}
                  </div>
                )}
              />
            </Container>
          )}

          {!accountState.loading && worldFavoriteList.length === 0 && (
            <Container className="favorites-list__empty">
              <Paragraph secondary>
                {l("pages.favorites.no_world_selected")}
                <br />
                <Link href={locations.worlds({})}>
                  {l("pages.favorites.go_to_worlds")}
                </Link>
                .
              </Paragraph>
            </Container>
          )}
        </div>
      )}
    </>
  )
}
