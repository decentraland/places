import React from "react"

import Helmet from "react-helmet"

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
  const [places] = useAsyncState(
    async () =>
      Places.get().getPlaces({
        limit: 24,
      }),
    [],
    {
      callWithTruthyDeps: true,
    }
  )

  return (
    <>
      <Helmet>
        <title>{l("social.places.title") || ""}</title>
        <meta
          name="description"
          content={l("social.places.description") || ""}
        />

        <meta property="og:title" content={l("social.places.title") || ""} />
        <meta
          property="og:description"
          content={l("social.places.description") || ""}
        />
        <meta property="og:image" content={l("social.places.image") || ""} />
        <meta property="og:site" content={l("social.places.site") || ""} />

        <meta name="twitter:title" content={l("social.places.title") || ""} />
        <meta
          name="twitter:description"
          content={l("social.places.description") || ""}
        />
        <meta name="twitter:image" content={l("social.places.image") || ""} />
        <meta name="twitter:card" content={l("social.places.card") || ""} />
        <meta
          name="twitter:creator"
          content={l("social.places.creator") || ""}
        />
        <meta name="twitter:site" content={l("social.places.site") || ""} />
      </Helmet>
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
