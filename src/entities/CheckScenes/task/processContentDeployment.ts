import {
  ContentDeploymentScene,
  ContentDeploymentWorld,
} from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import env from "decentraland-gatsby/dist/utils/env"
import uuid from "uuid"

import PlaceModel from "../../Place/model"
import { PlaceAttributes } from "../../Place/types"
import { getThumbnailFromContentDeployment } from "../../Place/utils"
import { isNewPlace, isSamePlace } from "../utils"

const PLACES_URL = env("PLACES_URL", "https://places.decentraland.org")

const placesAttributes: Array<keyof PlaceAttributes> = [
  "id",
  "title",
  "description",
  "image",
  "highlighted_image",
  "featured_image",
  "owner",
  "tags",
  "positions",
  "base_position",
  "contact_name",
  "contact_email",
  "content_rating",
  "likes",
  "dislikes",
  "favorites",
  "like_rate",
  "highlighted",
  "featured",
  "disabled",
  "disabled_at",
  "visible",
  "created_at",
  "updated_at",
]

export async function processContentDeployment(
  contentDeployment: ContentDeploymentScene | ContentDeploymentWorld
) {
  const places = await PlaceModel.findEnabledByPositions(
    contentDeployment.pointers
  )

  const isNew = isNewPlace(contentDeployment, places)
  if (isNew) {
    PlaceModel.insertPlace(
      createPlaceFromContentDeploymentScene(contentDeployment),
      placesAttributes
    )
  }

  if (isNew && places.length === 0) {
    return { isNewPlace: true, placesDisable: 0 }
  }

  if (isNew && places.length) {
    const placesToDisable = places.map((place) => place.id)
    PlaceModel.disablePlaces(placesToDisable)
    return { isNewPlace: true, placesDisable: placesToDisable.length }
  }

  const placesToDisable: string[] = []
  places.map((place) => {
    if (isSamePlace(contentDeployment, place)) {
      PlaceModel.updatePlace(
        createPlaceFromContentDeploymentScene(contentDeployment, places[0]),
        placesAttributes
      )
    } else {
      placesToDisable.push(place.id)
    }
  })

  if (placesToDisable.length) {
    PlaceModel.disablePlaces(placesToDisable)
  }

  return { isNewPlace: false, placesDisable: placesToDisable.length }
}

export function createPlaceFromContentDeploymentScene(
  contentDeploymentScene: ContentDeploymentScene,
  data: Partial<Omit<PlaceAttributes, "id">> = {}
) {
  const now = new Date()
  const title = contentDeploymentScene?.metadata?.display?.title || null
  const positions = (contentDeploymentScene?.pointers || []).sort()
  const tags = (contentDeploymentScene?.metadata?.tags || [])
    .slice(0, 100)
    .map((tag) => tag.slice(0, 25))

  const thumbnail = getThumbnailFromContentDeployment(contentDeploymentScene)

  let contact_name = contentDeploymentScene?.metadata?.contact?.name || null
  if (contact_name && contact_name.trim() === "author-name") {
    contact_name = null
  }

  const placeParsed = {
    id: uuid(),
    owner: contentDeploymentScene?.metadata?.owner || null,
    title: title ? title.slice(0, 50) : null,
    description: contentDeploymentScene?.metadata?.display?.description || null,
    image: thumbnail,
    positions,
    tags,
    likes: 0,
    dislikes: 0,
    favorites: 0,
    like_rate: 0,
    base_position:
      contentDeploymentScene?.metadata?.scene?.base || positions[0],
    contact_name,
    contact_email: contentDeploymentScene?.metadata?.contact?.email || null,
    content_rating:
      contentDeploymentScene?.metadata?.policy?.contentRating || null,
    highlighted: false,
    featured: false,
    disabled: false,
    visible: false,
    disabled_at:
      !!data.disabled && !data.disabled_at ? now : data.disabled_at || null,
    created_at: now,
    updated_at: now,
    ...data,
  }

  if (placeParsed.image && !placeParsed.image.startsWith("https")) {
    placeParsed.image = new URL(placeParsed.image, PLACES_URL).toString()
  }

  return placeParsed
}
