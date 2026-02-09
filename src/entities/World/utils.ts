import env from "decentraland-gatsby/dist/utils/env"

import {
  AggregateWorldAttributes,
  WorldLiveDataProps,
  WorldLivePerWorldProps,
} from "./types"

const DEFAULT_WORLD_LIVE_DATA = {} as WorldLiveDataProps

let memory = DEFAULT_WORLD_LIVE_DATA

export function worldsWithUserCount(
  worlds: AggregateWorldAttributes[],
  worldLiveData: WorldLivePerWorldProps[]
) {
  return worlds.map((world) => {
    const liveWorlds = worldLiveData.find(
      (liveData) =>
        liveData.worldName.toLowerCase() === world?.world_name?.toLowerCase()
    )

    const worldWithAggregates = {
      ...world,
      user_count: liveWorlds ? liveWorlds.users : 0,
    }

    return worldWithAggregates
  })
}

export const fetchWorldsLiveDataAndUpdateCache = async (): Promise<void> => {
  try {
    const liveFetch = await fetch(
      env(
        "WORLDS_LIVE_DATA",
        "https://worlds-content-server.decentraland.org/live-data"
      )
    )
    const liveData = await liveFetch.json()
    memory = liveData.data
  } catch (error) {
    memory = DEFAULT_WORLD_LIVE_DATA
  }
}

export const getWorldsLiveData = () => memory
