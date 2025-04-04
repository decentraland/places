import Time from "decentraland-gatsby/dist/utils/date/Time"
import env from "decentraland-gatsby/dist/utils/env"
import fetch, { RequestInit } from "node-fetch"
import deepmerge from "deepmerge"

import { HotScene } from "../Place/types"

const DEFAULT_HOST_SCENE = Object.freeze([]) as readonly HotScene[]

// Single memory reference for the most recent hot scenes data
let currentHotScenes: HotScene[] = [...DEFAULT_HOST_SCENE]

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

// TODO: Remove this once the Legacy Explorer is not longer used
export const processScene = (
  scene: HotScene,
  sceneMap: Map<string, HotScene>,
  isLegacy: boolean = false
) => {
  const key = `${scene.baseCoords[0]},${scene.baseCoords[1]}`

  if (sceneMap.has(key)) {
    const existingScene = sceneMap.get(key)!

    // If it's legacy data, we want to keep the existing scene data and only update realms and counts
    const baseScene = isLegacy ? existingScene : scene
    const updateScene = isLegacy ? scene : existingScene

    // First merge everything except usersTotalCount
    const { usersTotalCount: baseCount, ...baseRest } = baseScene
    const { usersTotalCount: updateCount, ...updateRest } = updateScene

    const mergedScene = {
      ...deepmerge(baseRest, updateRest, {
        arrayMerge: (_, source) => source,
      }),
      usersTotalCount: (baseCount || 0) + (updateCount || 0),
    }

    sceneMap.set(key, mergedScene)
  } else {
    sceneMap.set(key, deepmerge(scene, { realms: [] }))
  }
}

export const fetchHotScenesAndUpdateCache = async () => {
  let scenesMap: Map<string, HotScene> | undefined

  try {
    const [hotScenesLegacy, hotScenes] = await Promise.all([
      RealmProvider.get().getHotScenes(true),
      RealmProvider.get().getHotScenes(),
    ])

    // Create a new Map for each operation
    scenesMap = new Map<string, HotScene>()

    // Process legacy scenes first
    hotScenesLegacy.forEach((scene) => processScene(scene, scenesMap!, true))
    // Then process new scenes, which will take precedence
    hotScenes.forEach((scene) => processScene(scene, scenesMap!, false))

    // Update the current hot scenes with new data
    currentHotScenes = Array.from(scenesMap.values())
  } catch (error) {
    currentHotScenes = [...DEFAULT_HOST_SCENE]
  } finally {
    // Clean up the temporary Map
    if (scenesMap) {
      scenesMap.clear()
      scenesMap = undefined
    }
  }
}

export const getHotScenes = (): HotScene[] => {
  return [...currentHotScenes]
}
