import { WorldLivePerWorldProps } from "../../modules/worldsLiveData"
import { AggregatePlaceAttributes } from "../Place/types"

export function worldsWithUserCount(
  worlds: AggregatePlaceAttributes[],
  worldLiveData: WorldLivePerWorldProps[]
) {
  return worlds.map((world) => {
    const liveWorlds = worldLiveData.find(
      (liveData) =>
        liveData.worldName.toLocaleLowerCase ===
        world.world_name!.toLocaleLowerCase
    )

    const worldWithAggregates = {
      ...world,
      user_count: liveWorlds ? liveWorlds.users : 0,
    }

    return worldWithAggregates
  })
}
