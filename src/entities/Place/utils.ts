import { ContentEntityScene } from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import Land from "decentraland-gatsby/dist/utils/api/Land"
import env from "decentraland-gatsby/dist/utils/env"

import { SceneStats, SceneStatsMap } from "../../api/DataTeam"
import toCanonicalPosition from "../../utils/position/toCanonicalPosition"
import {
  AggregatePlaceAttributes,
  HotScene,
  PlaceAttributes,
  unwantedThumbnailHash,
} from "./types"

const DECENTRALAND_URL =
  process.env.GATSBY_DECENTRALAND_URL ||
  process.env.DECENTRALAND_URL ||
  "https://play.decentraland.org"

const CONTENT_SERVER_URL = env("PROFILE_URL", "https://peer.decentraland.org")

export function placeUrl(place: PlaceAttributes) {
  const target = new URL(
    env("PLACES_BASE_URL", "https://decentraland.org/places")
  )
  target.searchParams.set("position", toCanonicalPosition(place.base_position)!)
  target.pathname = "/places/place/"
  return target
}

export function worldUrl(place: PlaceAttributes) {
  const target = new URL(
    env("PLACES_BASE_URL", "https://decentraland.org/places")
  )
  target.searchParams.set("name", place.world_name!)
  target.pathname = `/places/world/`
  return target
}

export function siteUrl(pathname = "") {
  const target = new URL(
    env("PLACES_BASE_URL", "https://decentraland.org/places")
  )
  target.pathname = pathname ? `/places/${pathname}/` : "/places/"
  return target
}

/** @deprecated */
export function explorerUrl(
  place?: Pick<PlaceAttributes, "base_position" | "world_name">,
  realm?: string
) {
  return place?.world_name
    ? explorerWorldUrl(place)
    : explorerPlaceUrl(place, realm)
}

/** @private */
function explorerPlaceUrl(
  place?: Pick<PlaceAttributes, "base_position">,
  realm?: string
): string {
  const target = new URL("/", DECENTRALAND_URL)
  if (place?.base_position) {
    target.searchParams.set("position", place.base_position)
  }
  if (realm) {
    target.searchParams.set("realm", realm)
  }

  return target.toString()
}

/** @private */
function explorerWorldUrl(place: Pick<PlaceAttributes, "world_name">): string {
  const target = new URL("/", DECENTRALAND_URL)

  if (place) {
    target.searchParams.set("realm", place.world_name!)
  }

  return target.toString()
}

/** @deprecated */
export function getThumbnailFromDeployment(deployment: ContentEntityScene) {
  const positions = (deployment?.pointers || []).sort()
  let thumbnail = deployment?.metadata?.display?.navmapThumbnail || null
  if (thumbnail && !thumbnail.startsWith("https://")) {
    const content = deployment.content.find(
      (content) => content.file === thumbnail
    )
    if (!content || unwantedThumbnailHash.includes(content.hash)) {
      thumbnail = null
    } else {
      thumbnail = `${CONTENT_SERVER_URL}/content/contents/${content.hash}`
    }
  }

  if (!thumbnail) {
    thumbnail = Land.getInstance().getMapImage({
      selected: positions,
    })
  }
  return thumbnail
}

export function getThumbnailFromContentDeployment(
  deployment: ContentEntityScene,
  options: { url?: string } = {}
) {
  const positions = (deployment?.pointers || []).sort()
  let thumbnail = deployment?.metadata?.display?.navmapThumbnail || null
  if (thumbnail && !thumbnail.startsWith("https://")) {
    const content = deployment.content.find(
      (content) => content.file === thumbnail
    )
    const contentServerUrl = (
      options.url || `${CONTENT_SERVER_URL}/content`
    ).replace(/\/+$/, "")

    if (!content || unwantedThumbnailHash.includes(content.hash)) {
      thumbnail = null
    } else {
      thumbnail = `${contentServerUrl}/contents/${content.hash}`
    }
  }

  if (!thumbnail && deployment?.metadata?.worldConfiguration) {
    thumbnail =
      "https://peer.decentraland.org/content/contents/bafkreidj26s7aenyxfthfdibnqonzqm5ptc4iamml744gmcyuokewkr76y"
  } else if (!thumbnail) {
    thumbnail = Land.getInstance().getMapImage({
      selected: positions,
    })
  }
  return thumbnail
}

export function placesWithUserVisits(
  places: AggregatePlaceAttributes[],
  sceneStats: SceneStatsMap
) {
  return places.map((place) => {
    let stats: SceneStats | undefined = sceneStats[place.base_position]
    if (!stats) {
      const statsPosition = (place.positions || []).find(
        (position) => sceneStats[position]
      )
      if (statsPosition) {
        stats = sceneStats[statsPosition]
      }
    }

    return {
      ...place,
      user_visits: stats?.last_30d?.users || 0,
    }
  })
}

export function placesWithUserCount(
  places: AggregatePlaceAttributes[],
  hotScenes: HotScene[],
  options?: {
    withRealmsDetail: boolean
  }
) {
  return places.map((place) => {
    const hotScenePlaces = hotScenes.find((scene) =>
      scene.parcels
        .map((parsel) => parsel.join(","))
        .includes(place.base_position)
    )

    const placeWithAggregates = {
      ...place,
      user_count: hotScenePlaces ? hotScenePlaces.usersTotalCount : 0,
    }

    if (options?.withRealmsDetail) {
      placeWithAggregates.realms_detail = hotScenePlaces?.realms || []
    }

    return placeWithAggregates
  })
}

/** @deprecated */
export function placesWithLastUpdate(
  places: AggregatePlaceAttributes[],
  entityScene: (ContentEntityScene | null)[]
) {
  return places.map((place) => {
    const entityScenePlaces = entityScene.find(
      (scene) =>
        scene && scene.metadata.scene!.base.includes(place.base_position)
    )

    return {
      ...place,
      last_deployed_at: entityScenePlaces
        ? new Date(entityScenePlaces.timestamp)
        : undefined,
    }
  })
}
