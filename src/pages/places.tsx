import React from "react"

import { useLocation } from "@gatsbyjs/reach-router"
import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useAsyncState from "decentraland-gatsby/dist/hooks/useAsyncState"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Container } from "decentraland-ui/dist/components/Container/Container"
import Grid from "semantic-ui-react/dist/commonjs/collections/Grid"

import Places from "../api/Places"
import Navigation, { NavigationTab } from "../components/Layout/Navigation"
import PlaceCard from "../components/Place/PlaceCard/PlaceCard"

export default function IndexPage() {
  const l = useFormatMessage()
  const [account, accountState] = useAuthContext()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const [places] = useAsyncState(async () => Places.get().getPlaces(), [], {
    callWithTruthyDeps: true,
  })

  return (
    <>
      <Navigation activeTab={NavigationTab.Places} />
      <Grid stackable>
        <Grid.Row></Grid.Row>
      </Grid>
    </>
  )

  return (
    <Container>
      {(places || []).map((place) => (
        <PlaceCard place={place} />
      ))}
    </Container>
  )
}
