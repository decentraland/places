import React from "react"

import { Helmet } from "react-helmet"

import Title from "decentraland-gatsby/dist/components/Text/Title"
import useFormatMessage from "decentraland-gatsby/dist/hooks/useFormatMessage"
import { Container } from "decentraland-ui/dist/components/Container/Container"

import Navigation, { NavigationTab } from "../components/Layout/Navigation"

import "./index.css"

export default function PlacesPage() {
  const l = useFormatMessage()
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
      <Container style={{ paddingTop: "75px" }}>
        <Navigation activeTab={NavigationTab.MyPlaces} />
        <Title>{l("pages.my_places.title")}</Title>
      </Container>
    </>
  )
}
