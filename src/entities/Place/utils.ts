import API from "decentraland-gatsby/dist/utils/api/API"
import Catalyst from "decentraland-gatsby/dist/utils/api/Catalyst"
import {
  EntityScene,
  HotScene,
} from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import Land from "decentraland-gatsby/dist/utils/api/Land"
import Time from "decentraland-gatsby/dist/utils/date/Time"
import env from "decentraland-gatsby/dist/utils/env"
import { v4 as uuid } from "uuid"

import {
  AggregatePlaceAttributes,
  PlaceAttributes,
  unwantedThumbnailHash,
} from "./types"

const DECENTRALAND_URL =
  process.env.GATSBY_DECENTRALAND_URL ||
  process.env.DECENTRALAND_URL ||
  "https://play.decentraland.org"

const PLACES_URL = env("PLACES_URL", "https://places.decentraland.org")

export function siteUrl(pathname = "") {
  const target = new URL(DECENTRALAND_URL)
  target.pathname = pathname
  return target
}

export function placeTargetUrl(
  place: Pick<PlaceAttributes, "base_position">,
  realm?: string
): string {
  const target = new URL("/", DECENTRALAND_URL)
  target.searchParams.set("position", place.base_position)
  if (realm) {
    target.searchParams.set("realm", realm)
  }

  return target.toString()
}

export function getThumbnailFromDeployment(deployment: EntityScene) {
  const positions = (deployment?.pointers || []).sort()
  let thumbnail = deployment?.metadata?.display?.navmapThumbnail || null
  if (thumbnail && !thumbnail.startsWith("https://")) {
    const content = deployment.content.find(
      (content) => content.file === thumbnail
    )
    if (!content || unwantedThumbnailHash.includes(content.hash)) {
      thumbnail = null
    } else {
      thumbnail = `https://peer.decentraland.org/content/contents/${content.hash}`
    }
  }

  if (!thumbnail) {
    thumbnail = Land.get().getMapImage({
      selected: positions,
    })
  }
  return thumbnail
}

export function placesWithUserCount(
  places: AggregatePlaceAttributes[],
  hotScenes: HotScene[]
) {
  return places.map((place) => {
    const hotScenePlaces = hotScenes.find((scene) =>
      scene.parcels
        .map((parsel) => parsel.join(","))
        .includes(place.base_position)
    )

    return {
      ...place,
      user_count: hotScenePlaces ? hotScenePlaces.usersTotalCount : 0,
    }
  })
}

export function createPlaceFromEntityScene(
  entityScene: EntityScene,
  data: Partial<Omit<PlaceAttributes, "id">> = {}
) {
  const now = Time.from().format("YYYYMMDD hh:mm:ss ZZ")
  const title = entityScene?.metadata?.display?.title || null
  const positions = (entityScene?.pointers || []).sort()
  const tags = (entityScene?.metadata?.tags || [])
    .slice(0, 100)
    .map((tag) => tag.slice(0, 25))

  const thumbnail = getThumbnailFromDeployment(entityScene)

  let contact_name = entityScene?.metadata?.contact?.name || null
  if (contact_name && contact_name.trim() === "author-name") {
    contact_name = null
  }

  const placeParsed = {
    id: uuid(),
    owner: entityScene?.metadata?.owner || null,
    title: title ? title.slice(0, 50) : null,
    description: entityScene?.metadata?.display?.description || null,
    image: thumbnail,
    positions,
    tags,
    likes: 0,
    dislikes: 0,
    favorites: 0,
    like_rate: 0,
    base_position: entityScene?.metadata?.scene?.base || positions[0],
    contact_name,
    contact_email: entityScene?.metadata?.contact?.email || null,
    content_rating: entityScene?.metadata?.policy?.contentRating || null,
    featured: false,
    disabled: false,
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

export async function createEntityScenesFromDefaultPlaces(
  places: Partial<PlaceAttributes>[]
) {
  const batch = places.map((place) => place.base_position!)
  return Catalyst.get().getEntityScenes(batch)
}

export async function createPlaceFromDefaultPlaces(
  places: Partial<PlaceAttributes>[]
) {
  const entityScenes = await createEntityScenesFromDefaultPlaces(places)
  return entityScenes.map((entityScene) =>
    createPlaceFromEntityScene(
      entityScene,
      places.find((place) =>
        entityScene.pointers.includes(place.base_position!)
      )
    )
  )
}
