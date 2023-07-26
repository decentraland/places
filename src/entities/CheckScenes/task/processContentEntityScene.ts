import { ContentEntityScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import { v4 as uuid } from "uuid"

import PlaceModel from "../../Place/model"
import { PlaceAttributes } from "../../Place/types"
import { getThumbnailFromContentDeployment as getThumbnailFromContentEntityScene } from "../../Place/utils"
import { findNewDeployedPlace, findSamePlace } from "../utils"

export type ProcessEntitySceneResult =
  | {
      new: PlaceAttributes
      update?: never
      disabled: PlaceAttributes[]
    }
  | {
      new?: never
      update: PlaceAttributes
      disabled: PlaceAttributes[]
    }

export function processContentEntityScene(
  contentEntityScene: ContentEntityScene,
  places: PlaceAttributes[]
): ProcessEntitySceneResult | null {
  const samePlace = findSamePlace(contentEntityScene, places)
  const newDeployedPlace = findNewDeployedPlace(contentEntityScene, places)
  if (newDeployedPlace) {
    return null
  }
  if (!samePlace) {
    return {
      new: createPlaceFromContentEntityScene(contentEntityScene),
      disabled: places,
    }
  }

  return {
    update: createPlaceFromContentEntityScene(contentEntityScene, samePlace),
    disabled: places.filter((place) => samePlace.id !== place.id),
  }
}

export function createPlaceFromContentEntityScene(
  contentEntityScene: ContentEntityScene,
  data: Partial<Omit<PlaceAttributes, "id">> = {},
  options: { url?: string } = {}
) {
  const now = new Date()
  const title = contentEntityScene?.metadata?.display?.title || null
  const positions = (contentEntityScene?.pointers || []).sort()
  const tags = (contentEntityScene?.metadata?.tags || [])
    .slice(0, 100)
    .map((tag) => tag.slice(0, 25))

  const thumbnail = getThumbnailFromContentEntityScene(
    contentEntityScene,
    options
  )

  let contact_name = contentEntityScene?.metadata?.contact?.name || null
  if (contact_name && contact_name.trim() === "author-name") {
    contact_name = null
  }

  const worldName =
    contentEntityScene?.metadata?.worldConfiguration?.name ||
    contentEntityScene?.metadata?.worldConfiguration?.dclName ||
    null

  const placeParsed: PlaceAttributes = {
    id: uuid(),
    likes: 0,
    dislikes: 0,
    favorites: 0,
    like_rate: 0,
    highlighted: false,
    highlighted_image: null,
    featured: false,
    featured_image: null,
    disabled: false,
    updated_at: now,
    categories: [],
    world: !!contentEntityScene?.metadata?.worldConfiguration,
    world_name: worldName,
    hidden: !!contentEntityScene?.metadata?.worldConfiguration,
    ...data,
    title: title ? title.slice(0, 50) : "Untitled",
    description: contentEntityScene?.metadata?.display?.description || null,
    owner: contentEntityScene?.metadata?.owner || null,
    image: thumbnail,
    tags,
    base_position: contentEntityScene?.metadata?.scene?.base || positions[0],
    positions,
    contact_name,
    contact_email: contentEntityScene?.metadata?.contact?.email || null,
    content_rating: contentEntityScene?.metadata?.policy?.contentRating || null,
    created_at: now,
    deployed_at: new Date(contentEntityScene.timestamp),
    disabled_at:
      !!data.disabled && !data.disabled_at ? now : data.disabled_at || null,
    textsearch: undefined,
  }

  placeParsed.textsearch = PlaceModel.textsearch(placeParsed)

  return placeParsed
}
