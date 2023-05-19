import React, { useCallback, useEffect, useMemo } from "react"

import { Helmet } from "react-helmet"

import { useLocation } from "@gatsbyjs/reach-router"
import MaintenancePage from "decentraland-gatsby/dist/components/Layout/MaintenancePage"
import NotFound from "decentraland-gatsby/dist/components/Layout/NotFound"
import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useFeatureFlagContext from "decentraland-gatsby/dist/context/FeatureFlag/useFeatureFlagContext"
import useShareContext from "decentraland-gatsby/dist/context/Share/useShareContext"
import useTrackContext from "decentraland-gatsby/dist/context/Track/useTrackContext"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { navigate } from "decentraland-gatsby/dist/plugins/intl"
import { Container } from "decentraland-ui/dist/components/Container/Container"

import ItemLayout from "../components/Layout/ItemLayout"
import Navigation, { NavigationTab } from "../components/Layout/Navigation"
import PlaceDescription from "../components/Place/PlaceDescription/PlaceDescription"
import PlaceDetails from "../components/Place/PlaceDetails/PlaceDetails"
import { usePlaceFromParams } from "../hooks/usePlaceFromParams"
import usePlacesManager from "../hooks/usePlacesManager"
import { FeatureFlags } from "../modules/ff"
import locations from "../modules/locations"
import { SegmentPlace } from "../modules/segment"
import toCanonicalPosition from "../utils/position/toCanonicalPosition"
import { useGetCategoryFromId } from "../hooks/useGetCategortFromId"
import PlaceCard from "../components/Place/PlaceCard/PlaceCard"
import { AsyncStateResult } from "decentraland-gatsby/dist/hooks/useAsyncState"
import { Header } from "decentraland-ui/dist/components/Header/Header"

export type EventPageState = {
  updating: Record<string, boolean>
}

export default function CategoryPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [share] = useShareContext()
  const location = useLocation()

  const params = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  )

  const [categoriesFromId, _]: AsyncStateResult<
    { name: string; places: any[] },
    never[]
  > = useGetCategoryFromId(params.get("id")!) || {}

  console.log("flo", categoriesFromId)

  return (
    <>
      <Navigation activeTab={NavigationTab.Categories} />

      <Container className="my-places-list__container">
        <Header>{categoriesFromId.name}</Header>
        <Container
          style={{
            paddingTop: "75px",
            display: "flex",
            flexDirection: "row",
            gap: "20px",
            flexWrap: "wrap",
            marginTop: "-70px",
          }}
        >
          {categoriesFromId.places &&
            categoriesFromId.places.map((place, index) => (
              <PlaceCard key={place?.id || index} place={place} />
            ))}
        </Container>
      </Container>
    </>
  )
}
