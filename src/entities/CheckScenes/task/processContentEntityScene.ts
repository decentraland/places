import { ContentEntityScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import env from "decentraland-gatsby/dist/utils/env"
import uuid from "uuid"

import PlaceModel from "../../Place/model"
import { PlaceAttributes } from "../../Place/types"
import { getThumbnailFromContentDeployment as getThumbnailFromContentEntityScene } from "../../Place/utils"
import {
  notifyDisablePlaces,
  notifyNewPlace,
  notifyUpdatePlace,
} from "../../Slack/utils"
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
  contentEntityScene: ContentEntityScene
) {
  const places = await PlaceModel.findEnabledByPositions(
    contentEntityScene.pointers
  )

  const isNew = isNewPlace(contentEntityScene, places)
  if (isNew) {
    const newPlace = createPlaceFromContentEntityScene(contentEntityScene)
    PlaceModel.insertPlace(newPlace, placesAttributes)

    notifyNewPlace(newPlace)
  }

  if (isNew && places.length === 0) {
    return { isNewPlace: true, placesDisable: 0 }
  }

  if (isNew && places.length) {
    const placesToDisable = places.map((place) => place.id)
    PlaceModel.disablePlaces(placesToDisable)
    notifyDisablePlaces(places)
    return { isNewPlace: true, placesDisable: placesToDisable.length }
  }

  const placesToDisable: PlaceAttributes[] = []
  places.map((place) => {
    if (isSamePlace(contentEntityScene, place)) {
      const updatePlace = createPlaceFromContentEntityScene(
        contentEntityScene,
        place
      )
      PlaceModel.updatePlace(updatePlace, placesAttributes)
      notifyUpdatePlace(updatePlace)
    } else {
      placesToDisable.push(place)
    }
  })

  if (placesToDisable.length) {
    const placesIdToDisable = places.map((place) => place.id)
    PlaceModel.disablePlaces(placesIdToDisable)
    notifyDisablePlaces(placesToDisable)
  }

  return { isNewPlace: false, placesDisable: placesToDisable.length }
}

export function createPlaceFromContentEntityScene(
  contentEntityScene: ContentEntityScene,
  data: Partial<Omit<PlaceAttributes, "id">> = {}
) {
  const now = new Date()
  const title = contentEntityScene?.metadata?.display?.title || null
  const positions = (contentEntityScene?.pointers || []).sort()
  const tags = (contentEntityScene?.metadata?.tags || [])
    .slice(0, 100)
    .map((tag) => tag.slice(0, 25))

  const thumbnail = getThumbnailFromContentEntityScene(contentEntityScene)

  let contact_name = contentEntityScene?.metadata?.contact?.name || null
  if (contact_name && contact_name.trim() === "author-name") {
    contact_name = null
  }

  const placeParsed = {
    id: uuid(),
    owner: contentEntityScene?.metadata?.owner || null,
    title: title ? title.slice(0, 50) : null,
    description: contentEntityScene?.metadata?.display?.description || null,
    image: thumbnail,
    positions,
    tags,
    likes: 0,
    dislikes: 0,
    favorites: 0,
    like_rate: 0,
    base_position: contentEntityScene?.metadata?.scene?.base || positions[0],
    contact_name,
    contact_email: contentEntityScene?.metadata?.contact?.email || null,
    content_rating: contentEntityScene?.metadata?.policy?.contentRating || null,
    highlighted: false,
    highlighted_image: null,
    featured: false,
    featured_image: null,
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
