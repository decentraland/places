import React from "react"

import { useLocation } from "@gatsbyjs/reach-router"
import useAuthContext from "decentraland-gatsby/dist/context/Auth/useAuthContext"
import useAsyncState from "decentraland-gatsby/dist/hooks/useAsyncState"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Card } from "decentraland-ui/dist/components/Card/Card"
import { Container } from "decentraland-ui/dist/components/Container/Container"
import Grid from "semantic-ui-react/dist/commonjs/collections/Grid"

import Places from "../api/Places"
import Navigation, { NavigationTab } from "../components/Layout/Navigation"
import PlaceCard from "../components/Place/PlaceCard/PlaceCard"

import "./places.css"

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
      <Grid stackable className="places-page">
        <Grid.Row>
          <Grid.Column
            tablet={4}
            className="places-page__filters"
          ></Grid.Column>
          <Grid.Column tablet={12} className="places-page__list">
            <Card.Group>
              {(places || []).map((place) => (
                <PlaceCard place={place} />
              ))}
            </Card.Group>
          </Grid.Column>
        </Grid.Row>
      </Grid>
    </>
  )
}
