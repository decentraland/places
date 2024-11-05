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
    d1: number | null
    d3: number | null
    d7: number | null
    d14: number | null
    d28: number | null
  }
}

export type SceneStatsMap = Record<string, SceneStats>
