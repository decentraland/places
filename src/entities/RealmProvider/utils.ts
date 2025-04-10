import Time from "decentraland-gatsby/dist/utils/date/Time"
import env from "decentraland-gatsby/dist/utils/env"
import fetch, { RequestInit } from "node-fetch"

import { HotScene } from "../Place/types"

const DEFAULT_HOST_SCENE = Object.freeze([]) as readonly HotScene[]

// Single memory reference for the most recent hot scenes data
let currentHotScenes: HotScene[] = [...DEFAULT_HOST_SCENE]

export default class RealmProvider {
  static Url = env(
    "ARCHIPELAGO_URL",
    "https://archipelago-ea-stats.decentraland.org/"
  )
  static Cache = new Map<string, RealmProvider>()

  private url: string

  constructor(url: string) {
    this.url = url
  }

  // Singleton instance based on URL
  static from(url: string) {
    if (!this.Cache.has(url)) {
      this.Cache.set(url, new RealmProvider(url))
    }
    return this.Cache.get(url)!
  }

  static get() {
    return this.from(this.Url)
  }

  async getHotScenes(): Promise<HotScene[]> {
    const controller = new AbortController()

    const timeoutId = setTimeout(() => controller.abort(), Time.Second * 10)

    try {
      const response = await fetch(`${this.url}hot-scenes`, {
        signal: controller.signal as RequestInit["signal"],
      })
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
    const hotScenes = await RealmProvider.get().getHotScenes()
    // Update the current hot scenes with new data
    currentHotScenes = Array.from(hotScenes)
  } catch (error) {
    currentHotScenes = [...DEFAULT_HOST_SCENE]
  }
}

export const getHotScenes = (): HotScene[] => {
  return [...currentHotScenes]
}
