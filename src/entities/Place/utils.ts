import { ContentDepoymentScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import Land from "decentraland-gatsby/dist/utils/api/Land"
import { v4 as uuid } from "uuid"

import { PlaceAttributes } from "./types"

const DECENTRALAND_URL =
  process.env.GATSBY_DECENTRALAND_URL ||
  process.env.DECENTRALAND_URL ||
  "https://play.decentraland.org"

export function createPlaceFromDeployment(
  deployment: ContentDepoymentScene,
  data: Partial<Omit<PlaceAttributes, "id">> = {}
): PlaceAttributes {
  const now = new Date()
  const title = deployment?.metadata?.display?.title || null
  const positions = (deployment?.pointers || []).sort()
  const tags = (deployment?.metadata?.tags || [])
    .slice(0, 100)
    .map((tag) => tag.slice(0, 25))

  let thumbnail = deployment?.metadata?.display?.navmapThumbnail || null
  if (thumbnail && !thumbnail.startsWith("https://")) {
    const content = deployment.content.find(
      (content) => content.key === thumbnail
    )
    if (
      !content ||
      content.hash ===
        "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku"
    ) {
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

  let contact_name = deployment?.metadata?.contact?.name || null
  if (contact_name && contact_name.trim() === "author-name") {
    contact_name = null
  }

  return {
    id: uuid(),
    owner: deployment?.metadata?.owner || null,
    title: title ? title.slice(0, 50) : null,
    description: deployment?.metadata?.display?.description || null,
    image: thumbnail,
    positions,
    tags,
    likes: 0,
    dislikes: 0,
    favorites: 0,
    popularity_score: 0.5,
    activity_score: BigInt(0),
    base_position: deployment?.metadata?.scene?.base || positions[0],
    contact_name,
    contact_email: deployment?.metadata?.contact?.email || null,
    content_rating: deployment?.metadata?.policy?.contentRating || null,
    disabled: false,
    disabled_at:
      !!data.disabled && !data.disabled_at ? now : data.disabled_at || null,
    deployed_at: new Date(deployment.entityTimestamp),
    created_at: now,
    updated_at: now,
    ...data,
  }
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
