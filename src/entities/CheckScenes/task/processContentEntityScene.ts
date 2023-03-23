import { ContentEntityScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import env from "decentraland-gatsby/dist/utils/env"
import { v4 as uuid } from "uuid"

import PlaceModel from "../../Place/model"
import { PlaceAttributes } from "../../Place/types"
import { getThumbnailFromContentDeployment as getThumbnailFromContentEntityScene } from "../../Place/utils"
import {
  notifyDisablePlaces,
  notifyNewPlace,
  notifyUpdatePlace,
} from "../../Slack/utils"
import { isNewPlace, isSamePlace, isSameWorld } from "../utils"

const PLACES_URL = env("PLACES_URL", "https://places.decentraland.org")

const placesAttributes: Array<keyof PlaceAttributes> = [
  "id",
  "title",
  "description",
  "image",
  "owner",
  "tags",
  "positions",
  "base_position",
  "contact_name",
  "contact_email",
  "content_rating",
  "disabled",
  "disabled_at",
  "visible",
  "created_at",
  "updated_at",
  "categories",
  "world",
  "world_name",
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
    await PlaceModel.insertPlace(newPlace, placesAttributes)
    notifyNewPlace(newPlace)
  }

  if (
    isNew &&
    (places.length === 0 || contentEntityScene.metadata.worldConfiguration)
  ) {
    return { isNewPlace: true, placesDisable: 0 }
  }

  if (
    isNew &&
    places.length &&
    !contentEntityScene.metadata.worldConfiguration
  ) {
    const placesToDisable = places.map((place) => place.id)
    await PlaceModel.disablePlaces(placesToDisable)
    notifyDisablePlaces(places)
    return { isNewPlace: true, placesDisable: placesToDisable.length }
  }

  if (contentEntityScene.metadata.worldConfiguration) {
    const placeWorld = places.find((place) =>
      isSameWorld(contentEntityScene, place)
    )
    const updatePlace = createPlaceFromContentEntityScene(
      contentEntityScene,
      createPlaceImmutable(placeWorld!)
    )
    await PlaceModel.updatePlace(updatePlace, placesAttributes)
    notifyUpdatePlace(updatePlace)
    return { isNewPlace: false, placesDisable: 0 }
  }

  const placesToDisable: PlaceAttributes[] = []

  places.map(async (place) => {
    if (isSamePlace(contentEntityScene, place)) {
      const updatePlace = createPlaceFromContentEntityScene(
        contentEntityScene,
        createPlaceImmutable(place)
      )
      await PlaceModel.updatePlace(updatePlace, placesAttributes)
      notifyUpdatePlace(updatePlace)
    } else {
      placesToDisable.push(place)
    }
  })

  if (placesToDisable.length) {
    const placesIdToDisable = places.map((place) => place.id)
    await PlaceModel.disablePlaces(placesIdToDisable)
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
    categories: [],
    world: !!contentEntityScene?.metadata?.worldConfiguration,
    world_name: contentEntityScene?.metadata?.worldConfiguration
      ? contentEntityScene?.metadata?.worldConfiguration.name
      : null,
    ...data,
  }

  if (placeParsed.image && !placeParsed.image.startsWith("https")) {
    placeParsed.image = new URL(placeParsed.image, PLACES_URL).toString()
  }

  return placeParsed
}

export function createPlaceImmutable(
  place: Partial<Omit<PlaceAttributes, "id">>
) {
  return {
    highlighted: place.highlighted,
    highlighted_image: place.highlighted_image,
    featured: place.featured,
    featured_image: place.featured_image,
    likes: place.likes,
    dislikes: place.dislikes,
    favorites: place.favorites,
    like_rate: place.like_rate,
    disabled: place.disabled,
    disabled_at: place.disabled_at,
    created_at: place.created_at,
  }
}
