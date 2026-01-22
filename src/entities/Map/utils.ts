import { AggregateCoordinatePlaceAttributes } from "./types"
import { SceneStats, SceneStatsMap } from "../../api/DataTeam"
import { AggregatePlaceAttributes, HotScene } from "../Place/types"
import { WorldLiveDataProps } from "../World/types"

export function placesWithCoordinatesAggregates(
  places: AggregateCoordinatePlaceAttributes[],
  hotScenes: HotScene[],
  sceneStats: SceneStatsMap,
  options?: {
    withRealmsDetail: boolean
  }
) {
  const placesWithAggregates: Record<
    string,
    AggregateCoordinatePlaceAttributes
  > = {}

  for (const place of places) {
    const stats: SceneStats | undefined =
      sceneStats[place.base_position] ||
      (place.positions || []).reduce<SceneStats | undefined>(
        (acc, position) => acc || sceneStats[position],
        undefined
      )

    const hotScenePlaces = hotScenes.find((scene) =>
      scene.parcels
        .map((parsel) => parsel.join(","))
        .includes(place.base_position)
    )

    if (options?.withRealmsDetail) {
      place.realms_detail = hotScenePlaces?.realms || []
    }

    placesWithAggregates[place.base_position] = {
      ...place,
      user_visits: stats?.last_30d?.users || 0,
      user_count: hotScenePlaces ? hotScenePlaces.usersTotalCount : 0,
      positions: undefined,
    }
  }

  return placesWithAggregates
}

export function allPlacesWithAggregates(
  places: AggregatePlaceAttributes[],
  hotScenes: HotScene[],
  placesSceneStats: SceneStatsMap,
  worldsLiveData: WorldLiveDataProps,
  // worldStats: WorldStats,
  options?: {
    withRealmsDetail: boolean
  }
) {
  return places.map((place) => {
    const placesStats: SceneStats | undefined =
      placesSceneStats[place.base_position] ||
      (place.positions || []).reduce<SceneStats | undefined>(
        (acc, position) => acc || placesSceneStats[position],
        undefined
      )
    let user_count = 0
    let user_visits = 0

    const hotScenePlaces = hotScenes.find((scene) =>
      scene.parcels
        .map((parsel) => parsel.join(","))
        .includes(place.base_position)
    )

    if (place.world) {
      user_count =
        (worldsLiveData?.perWorld &&
          worldsLiveData.perWorld.find(
            (world) => world.worldName === place.world_name
          )?.users) ||
        0
      // TODO: Get Worlds user visits
      // user_visits = worldStats?.last_30d?.users || 0
    } else {
      user_count = hotScenePlaces?.usersTotalCount || 0
      user_visits = placesStats?.last_30d?.users || 0
    }

    if (options?.withRealmsDetail && !place.world) {
      place.realms_detail = hotScenePlaces?.realms || []
    }

    return {
      ...place,
      user_visits: user_visits,
      user_count: user_count,
    }
  })
}
