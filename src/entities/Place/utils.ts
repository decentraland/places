import {
  EntityScene,
  HotScene,
} from "decentraland-gatsby/dist/utils/api/Catalyst.types"
import Land from "decentraland-gatsby/dist/utils/api/Land"
import env from "decentraland-gatsby/dist/utils/env"

import { SceneStats, SceneStatsMap } from "../../api/DataTeam"
import toCanonicalPosition from "../../utils/position/toCanonicalPosition"
import {
  AggregatePlaceAttributes,
  PlaceAttributes,
  unwantedThumbnailHash,
} from "./types"

const DECENTRALAND_URL =
  process.env.GATSBY_DECENTRALAND_URL ||
  process.env.DECENTRALAND_URL ||
  "https://play.decentraland.org"

export function explorerUrl(pathname = "") {
  const target = new URL(DECENTRALAND_URL)
  target.pathname = pathname
  return target
}

export function placeUrl(place: PlaceAttributes) {
  const target = new URL(env("PLACES_URL", "https://places.decentraland.org"))
  target.searchParams.set("position", toCanonicalPosition(place.base_position)!)
  target.pathname = `/place/`
  return target
}

export function siteUrl(pathname = "") {
  const target = new URL(env("PLACES_URL", "https://places.decentraland.org"))
  target.pathname = pathname
  return target
}

export function explorerPlaceUrl(
  place: Pick<PlaceAttributes, "base_position">,
  realm?: string
): string {
  const target = new URL("/", DECENTRALAND_URL)
  if (place) {
    target.searchParams.set("position", place.base_position)
  }
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
      placeWithAggregates.realms_detail = hotScenePlaces?.realms
    }

    return placeWithAggregates
  })
}

export function placesWithLastUpdate(
  places: AggregatePlaceAttributes[],
  entityScene: (EntityScene | null)[]
) {
  return places.map((place) => {
    const entityScenePlaces = entityScene.find(
      (scene) =>
        scene && scene.metadata.scene.base.includes(place.base_position)
    )

    return {
      ...place,
      last_deployed_at: entityScenePlaces
        ? new Date(entityScenePlaces.timestamp)
        : undefined,
    }
  })
}
