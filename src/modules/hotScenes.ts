import Time from "decentraland-gatsby/dist/utils/date/Time"

import RealmProvider from "../api/RealmProvider"
import { HotScene } from "../entities/Place/types"

const DEFAULT_HOST_SCENE = [] as HotScene[]

let memory = DEFAULT_HOST_SCENE

export const getHotScenes = () => {
  return memory
}

setInterval(async () => {
  try {
    const response = await RealmProvider.get().getHotScenes()
    memory = response
  } catch (error) {
    memory = DEFAULT_HOST_SCENE
  }
}, Time.Minute)
