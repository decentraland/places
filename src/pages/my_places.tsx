import React, { useCallback, useMemo } from "react"

import { Helmet } from "react-helmet"

import { useLocation } from "@gatsbyjs/reach-router"
import Link from "decentraland-gatsby/dist/components/Text/Link"
import Paragraph from "decentraland-gatsby/dist/components/Text/Paragraph"
import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { navigate } from "decentraland-gatsby/dist/plugins/intl"
import API from "decentraland-gatsby/dist/utils/api/API"
import { Container } from "decentraland-ui/dist/components/Container/Container"
import { Header } from "decentraland-ui/dist/components/Header/Header"
import { useMobileMediaQuery } from "decentraland-ui/dist/components/Media/Media"
import { Pagination } from "decentraland-ui/dist/components/Pagination/Pagination"
import { SignIn } from "decentraland-ui/dist/components/SignIn/SignIn"

import Navigation, { NavigationTab } from "../components/Layout/Navigation"
import PlaceList from "../components/Place/PlaceList/PlaceList"
import { usePlaceListMyFavorites } from "../hooks/usePlaceListMyFavorites"
import usePlacesManager from "../hooks/usePlacesManager"
import locations, { toPlacesOptions } from "../modules/locations"

import "./my_places.css"

const PAGE_SIZE = 24

export default function PlacesPage() {
  const l = useFormatMessage()
  const mobile = useMobileMediaQuery()
  const [account, accountState] = useAuthContext()
  const location = useLocation()
  const [options, params] = useMemo(() => {
    const params = toPlacesOptions(new URLSearchParams(location.search))
    const paginationResult = API.fromPagination(params, {
      pageSize: PAGE_SIZE,
    })
    return [
      { limit: paginationResult.limit, offset: paginationResult.offset },
      params,
    ] as const
  }, [location.search])

  const [placeListMyFavorites, placeListMyFavoritesState] =
    usePlaceListMyFavorites(options)

  const placesMemo = useMemo(
    () => [placeListMyFavorites.data],
    [placeListMyFavorites.data]
  )

  const [[myFavoritesList], { handleFavorite, handlingFavorite }] =
    usePlacesManager(placesMemo)

  const handleChangePage = useCallback(
    (e: React.SyntheticEvent<any>, props: { activePage?: number | string }) => {
      e.preventDefault()
      e.stopPropagation()
      navigate(locations.my_places({ page: Number(props.activePage ?? 1) }))
    },
    [params]
  )

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
      <Container className="my-places-list__container">
        <Header>{l("pages.my_places.favorites")}</Header>
        {!accountState.loading && myFavoritesList.length === 0 && (
          <Paragraph secondary>
            {l("pages.my_places.no_favorite_selected")}{" "}
            <Link
              href={locations.home()}
              onClick={(e) => {
                e.preventDefault()
                navigate(locations.home())
              }}
            >
              {l("pages.my_places.go_to_overview")}
            </Link>
            .
          </Paragraph>
        )}
        <PlaceList
          places={myFavoritesList || []}
          onClickFavorite={(_, place) => handleFavorite(place.id, place)}
          loading={placeListMyFavoritesState.loading}
          className="my-places-list__place-list"
          loadingFavorites={handlingFavorite}
        />
        <div className="places__pagination">
          <Pagination
            activePage={params.page}
            totalPages={Math.ceil(placeListMyFavorites.total / PAGE_SIZE) || 1}
            onPageChange={handleChangePage}
            firstItem={mobile ? null : undefined}
            lastItem={mobile ? null : undefined}
            boundaryRange={mobile ? 1 : undefined}
            siblingRange={mobile ? 0 : undefined}
          />
        </div>
      </Container>
    </>
  )
}
