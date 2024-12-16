import Time from "decentraland-gatsby/dist/utils/date/Time"
import env from "decentraland-gatsby/dist/utils/env"
import fetch, { RequestInit } from "node-fetch"

import { HotScene } from "../Place/types"

const DEFAULT_HOST_SCENE = [] as HotScene[]

let memory = DEFAULT_HOST_SCENE

// TODO: Remove urlLegacy reference once the Legacy Explorer is not longer used
export default class RealmProvider {
  static Url = env(
    "ARCHIPELAGO_URL",
    "https://archipelago-ea-stats.decentraland.org/"
  )
  static UrlLegacy = env(
    "REALM_PROVIDER_URL",
    "https://realm-provider.decentraland.org/"
  )
  static Cache = new Map<string, RealmProvider>()

  private url: string
  private urlLegacy: string

  constructor(url: string, urlLegacy: string) {
    this.url = url
    this.urlLegacy = urlLegacy
  }

  // Singleton instance based on URL
  static from(url: string, urlLegacy: string) {
    if (!this.Cache.has(url)) {
      this.Cache.set(url, new RealmProvider(url, urlLegacy))
    }
    return this.Cache.get(url)!
  }

  static get() {
    return this.from(this.Url, this.UrlLegacy)
  }

  async getHotScenes(isLegeacy = false): Promise<HotScene[]> {
    const controller = new AbortController()

    const timeoutId = setTimeout(() => controller.abort(), Time.Second * 10)

    try {
      const response = await fetch(
        `${isLegeacy ? this.urlLegacy : this.url}hot-scenes`,
        {
          signal: controller.signal as RequestInit["signal"],
        }
      )
      if (!response.ok) {
        throw new Error(`Failed to fetch hot scenes: ${response.statusText}`)
      }
      return await response.json()
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

export const fetchHotScenesAndUpdateCache = async () => {
  try {
    const [hotScenesLegacy, hotScenes] = await Promise.all([
      RealmProvider.get().getHotScenes(true),
      RealmProvider.get().getHotScenes(),
    ])

    // Create a Map to store scenes by their baseCoords
    const scenesMap = new Map<string, HotScene>()

    // Process both arrays
    const processScene = (scene: HotScene, sceneMap: Map<string, HotScene>) => {
      const key = `${scene.baseCoords[0]},${scene.baseCoords[1]}`
      if (sceneMap.has(key)) {
        // If scene exists, sum the users count
        const existingScene = sceneMap.get(key)!
        sceneMap.set(key, {
          ...existingScene,
          usersTotalCount:
            existingScene.usersTotalCount + scene.usersTotalCount,
        })
      } else {
        sceneMap.set(key, scene)
      }
    }

    // Process both arrays
    hotScenesLegacy.forEach((scene) => processScene(scene, scenesMap))
    hotScenes.forEach((scene) => processScene(scene, scenesMap))

    memory = Array.from(scenesMap.values())
  } catch (error) {
    memory = DEFAULT_HOST_SCENE
  }
}

export const getHotScenes = () => {
  return memory
}
