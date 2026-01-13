import { SceneStats, SceneStatsMap } from "../../api/DataTeam"
import { AggregatePlaceAttributes, HotScene } from "../Place/types"
import { WorldLiveDataProps } from "../World/types"

export function destinationsWithAggregates(
  destinations: AggregatePlaceAttributes[],
  hotScenes: HotScene[],
  placesSceneStats: SceneStatsMap,
  worldsLiveData: WorldLiveDataProps,
  options?: {
    withRealmsDetail: boolean
  }
) {
  return destinations.map((destination) => {
    const placesStats: SceneStats | undefined =
      placesSceneStats[destination.base_position] ||
      (destination.positions || []).reduce<SceneStats | undefined>(
        (acc, position) => acc || placesSceneStats[position],
        undefined
      )
    let user_count = 0
    let user_visits = 0

    const hotScenePlaces = hotScenes.find((scene) =>
      scene.parcels
        .map((parcel) => parcel.join(","))
        .includes(destination.base_position)
    )

    if (destination.world) {
      user_count =
        (worldsLiveData?.perWorld &&
          worldsLiveData.perWorld.find(
            (world) => world.worldName === destination.world_name
          )?.users) ||
        0
      // TODO: Get Worlds user visits when available
      // user_visits = worldStats?.last_30d?.users || 0
    } else {
      user_count = hotScenePlaces?.usersTotalCount || 0
      user_visits = placesStats?.last_30d?.users || 0
    }

    if (options?.withRealmsDetail && !destination.world) {
      destination.realms_detail = hotScenePlaces?.realms || []
    }

    return {
      ...destination,
      user_visits: user_visits,
      user_count: user_count,
    }
  })
}
