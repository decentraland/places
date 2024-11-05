import React from "react"

import ApiCard from "decentraland-gatsby/dist/components/Docs/ApiCard"
import ApiDetails from "decentraland-gatsby/dist/components/Docs/ApiDetails"
import { Container } from "decentraland-ui/dist/components/Container/Container"

import Navigation from "../components/Layout/Navigation"
import { mapPlaceResponseSchema } from "../entities/Map/schemas"
import {
  getPlaceListQuerySchema,
  getPlaceParamsSchema,
  placeListResponseSchema,
  placeResponseSchema,
} from "../entities/Place/schemas"
import {
  updateUserFavoriteBodySchema,
  userFavoriteResponseSchema,
} from "../entities/UserFavorite/schema"
import {
  updateUserLikeBodySchema,
  userLikeResponseSchema,
} from "../entities/UserLikes/schema"
import {
  getWorldListQuerySchema,
  worldListResponseSchema,
} from "../entities/World/schemas"

import "./index.css"

export type IndexPageState = {
  updating: Record<string, boolean>
}

export default function DocsPage() {
  return (
    <>
      <Navigation />
      <Container>
        <ApiCard
          id="get-places"
          method="GET"
          path="/api/places"
          description="Returns the list of the places"
        >
          <ApiDetails
            title="Request"
            cors="*"
            query={getPlaceListQuerySchema}
          />
          <ApiDetails title="Response" body={placeListResponseSchema} />
        </ApiCard>

        <ApiCard
          id="get-place"
          method="GET"
          path="/api/places/{place_id}"
          description="Returns information about an place by ID"
        >
          <ApiDetails title="Request" cors="*" params={getPlaceParamsSchema} />
          <ApiDetails title="Response" body={placeResponseSchema} />
        </ApiCard>

        <ApiCard
          id="patch-user-favorite"
          method="PATCH"
          path="/places/{place_id}/favorites"
          description="Add or remove favorite to user"
        >
          <ApiDetails
            title="Request"
            cors="*"
            authorization
            params={updateUserFavoriteBodySchema}
          />
          <ApiDetails
            title="Response"
            cors="*"
            params={userFavoriteResponseSchema}
          />
        </ApiCard>

        <ApiCard
          id="patch-user-likes"
          method="PATCH"
          path="/places/{place_id}/likes"
          description="Toggle between like, dislike, or none"
        >
          <ApiDetails
            title="Request"
            cors="*"
            authorization
            params={updateUserLikeBodySchema}
          />
          <ApiDetails
            title="Response"
            cors="*"
            params={userLikeResponseSchema}
          />
        </ApiCard>

        <ApiCard
          id="get-worlds"
          method="GET"
          path="/api/worlds"
          description="Returns the list of the worlds"
        >
          <ApiDetails
            title="Request"
            cors="*"
            query={getWorldListQuerySchema}
          />
          <ApiDetails title="Response" body={worldListResponseSchema} />
        </ApiCard>

        <ApiCard
          id="maps"
          method="GET"
          path="/api/map"
          description="Returns an object with each Place's base position as the key"
        >
          <ApiDetails
            title="Request"
            cors="*"
            query={getPlaceListQuerySchema}
          />
          {/* TODO: Update ApiDetails component to render AJV patternProperties */}
          <ApiDetails title="Response" body={mapPlaceResponseSchema} />
        </ApiCard>
      </Container>
    </>
  )
}
