import API from "decentraland-gatsby/dist/utils/api/API"
import env from "decentraland-gatsby/dist/utils/env"

export type SceneStatsMap = Record<string, SceneStats>

export type SceneStats = {
  yesterday: {
    users: number
    sessions: number
    median_session_time: null
    max_concurrent_users: number
  }
  last_7d: {
    users: number
    sessions: number
    median_session_time: number
    max_concurrent_users: number
  }
  last_30d: {
    users: number
    sessions: number
    median_session_time: number
    max_concurrent_users: number
  }
  retention: {
    d1: number
    d3: number
    d7: number
    d14: number
    d28: number
  }
}

export default class DataTeam extends API {
  static Url = env(`DATA_TEAM_URL`, `https://cdn-data.decentraland.org/`)

  static Cache = new Map<string, DataTeam>()

  static from(url: string) {
    if (!this.Cache.has(url)) {
      this.Cache.set(url, new DataTeam(url))
    }

    return this.Cache.get(url)!
  }

  static get() {
    return this.from(env("DATA_TEAM_URL", this.Url))
  }

  async getSceneStats() {
    return this.fetch<Record<string, SceneStats>>("/scenes/scene-stats.json")
  }
}
