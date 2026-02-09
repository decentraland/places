import React, { useCallback, useMemo } from "react"

import { Helmet } from "react-helmet"

import { useLocation } from "@gatsbyjs/reach-router"
import MaintenancePage from "decentraland-gatsby/dist/components/Layout/MaintenancePage"
import Link from "decentraland-gatsby/dist/components/Text/Link"
import Paragraph from "decentraland-gatsby/dist/components/Text/Paragraph"
import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import { DappsFeatureFlags } from "decentraland-gatsby/dist/context/FeatureFlag/types"
import useFeatureFlagContext from "decentraland-gatsby/dist/context/FeatureFlag/useFeatureFlagContext"
import useTrackContext from "decentraland-gatsby/dist/context/Track/useTrackContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { back, navigate } from "decentraland-gatsby/dist/plugins/intl"
import API from "decentraland-gatsby/dist/utils/api/API"
import { Back } from "decentraland-ui/dist/components/Back/Back"
import { Container } from "decentraland-ui/dist/components/Container/Container"
import { Header } from "decentraland-ui/dist/components/Header/Header"
import { useMobileMediaQuery } from "decentraland-ui/dist/components/Media/Media"
import { Pagination } from "decentraland-ui/dist/components/Pagination/Pagination"
import { SignIn } from "decentraland-ui/dist/components/SignIn/SignIn"

import Navigation from "../../components/Layout/Navigation"
import PlaceList from "../../components/Place/PlaceList/PlaceList"
import useEntitiesManager from "../../hooks/useEntitiesManager"
import { usePlaceListMyFavorites } from "../../hooks/usePlaceListMyFavorites"
import { FeatureFlags } from "../../modules/ff"
import locations, { toPlacesOptions } from "../../modules/locations"
import { SegmentPlace } from "../../modules/segment"

import "./favorites.css"

const PAGE_SIZE = 24

export default function FavoritesPage() {
  const l = useFormatMessage()
  const isMobile = useMobileMediaQuery()
  const [account, accountState] = useAuthContext()
  const location = useLocation()
  const track = useTrackContext()
  const [options, params] = useMemo(() => {
    const params = toPlacesOptions(new URLSearchParams(location.search))
    const paginationResult = API.fromPagination(params, {
      pageSize: PAGE_SIZE,
    })

    return [
      { limit: paginationResult.limit, offset: paginationResult.offset },
      params,
    ] as const
  }, [location.search, track])

  const isSearching = !!params.search && params.search.length > 2
  const search = (isSearching && params.search) || ""

  const [placeListMyFavorites, placeListMyFavoritesState] =
    usePlaceListMyFavorites(options, search)

  const placesMemo = useMemo(
    () => [placeListMyFavorites.data],
    [placeListMyFavorites.data]
  )

  const [[myFavoritesList], { handleFavorite, handlingFavorite }] =
    useEntitiesManager(placesMemo)

  const handleChangePage = useCallback(
    (e: React.SyntheticEvent<any>, props: { activePage?: number | string }) => {
      e.preventDefault()
      e.stopPropagation()
      const newParams = { page: Number(props.activePage ?? 1) }

      navigate(locations.favoritesPlaces(newParams))
    },
    [params, track]
  )

  const handleClickBack = useCallback(() => {
    back()
  }, [track])

  const [ff] = useFeatureFlagContext()
  const isAuthDappEnabled = ff.enabled(DappsFeatureFlags.AuthDappEnabled)

  if (ff.flags[FeatureFlags.Maintenance]) {
    return <MaintenancePage />
  }

  if (!account || accountState.loading) {
    return (
      <>
        <Helmet>
          <title>{l("social.favorites.title_places") || ""}</title>
          <meta
            name="description"
            content={l("social.favorites.description") || ""}
          />

          <meta
            property="og:title"
            content={l("social.favorites.title_places") || ""}
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
            content={l("social.favorites.title_places") || ""}
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
        <Navigation />
        <Container className="favorites-list__sign-in">
          <SignIn
            isConnecting={accountState.loading}
            onConnect={
              isAuthDappEnabled ? accountState.authorize : accountState.select
            }
          />
        </Container>
      </>
    )
  }

  return (
    <>
      <Helmet>
        <title>{l("social.favorites.title_places") || ""}</title>
        <meta
          name="description"
          content={l("social.favorites.description") || ""}
        />

        <meta
          property="og:title"
          content={l("social.favorites.title_places") || ""}
        />
        <meta
          property="og:description"
          content={l("social.favorites.description") || ""}
        />
        <meta property="og:image" content={l("social.favorites.image") || ""} />
        <meta property="og:site" content={l("social.favorites.site") || ""} />

        <meta
          name="twitter:title"
          content={l("social.favorites.title_places") || ""}
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
      <Navigation />
      <Container className="favorites-list__container">
        <div className="favorites-list__back">
          <Back onClick={handleClickBack} />
          <p>{l("pages.favorites.back")}</p>
        </div>
        <Header>{l("pages.favorites.places")}</Header>
        {!accountState.loading && myFavoritesList.length === 0 && (
          <Container className="favorites-list__empty">
            <Paragraph secondary>
              {l("pages.favorites.no_favorite_selected")}
              <br />
              <Link href={locations.genesis({})}>
                {l("pages.favorites.go_to_places")}
              </Link>
            </Paragraph>
          </Container>
        )}
        <PlaceList
          places={myFavoritesList || []}
          onClickFavorite={(e, place) =>
            handleFavorite(place.id, place, {
              place: e.currentTarget.dataset.place!,
            })
          }
          loading={placeListMyFavoritesState.loading}
          className="favorites-list__place-list"
          loadingFavorites={handlingFavorite}
          dataPlace={SegmentPlace.FavoritesPlaces}
        />
        {!accountState.loading && myFavoritesList.length !== 0 && (
          <div className="places__pagination">
            <Pagination
              activePage={params.page}
              totalPages={
                Math.ceil(placeListMyFavorites.total / PAGE_SIZE) || 1
              }
              onPageChange={handleChangePage}
              firstItem={isMobile ? null : undefined}
              lastItem={isMobile ? null : undefined}
              boundaryRange={isMobile ? 1 : undefined}
              siblingRange={isMobile ? 0 : undefined}
            />
          </div>
        )}
      </Container>
    </>
  )
}
