import { SceneStats, SceneStatsMap } from "../../api/DataTeam"
import { HotScene } from "../Place/types"
import { AggregateCoordinatePlaceAttributes } from "./types"

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
    let stats: SceneStats | undefined = sceneStats[place.base_position]

    if (!stats) {
      const statsPosition = (place.positions || []).find(
        (position) => sceneStats[position]
      )
      if (statsPosition) {
        stats = sceneStats[statsPosition]
      }
    }

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
