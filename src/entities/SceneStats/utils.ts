import env from "decentraland-gatsby/dist/utils/env"
import fetch from "node-fetch"

import { SceneStatsMap } from "./types"

export default class DataTeam {
  static Url = env("DATA_TEAM_URL", "https://cdn-data.decentraland.org/")

  static Cache = new Map<string, DataTeam>()

  private url: string

  constructor(url: string) {
    this.url = url
  }

  static from(url: string) {
    if (!this.Cache.has(url)) {
      this.Cache.set(url, new DataTeam(url))
    }

    return this.Cache.get(url)!
  }

  static get() {
    return this.from(env("DATA_TEAM_URL", this.Url))
  }

  async getSceneStats(): Promise<SceneStatsMap> {
    const response = await fetch(`${this.url}scenes/scene-stats.json`)
    if (!response.ok) {
      throw new Error(`Failed to fetch scene stats: ${response.statusText}`)
    }

    return await response.json()
  }
}

export async function getSceneStats() {
  return await DataTeam.get().getSceneStats()
}
