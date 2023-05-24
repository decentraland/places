import { SceneStatsMap } from "../api/DataTeam"

export const sceneStatsGenesisPlaza: SceneStatsMap = {
  "-9,-9": {
    yesterday: {
      users: 1506,
      sessions: 1961,
      median_session_time: null,
      max_concurrent_users: 224,
    },
    last_7d: {
      users: 5241,
      sessions: 8086,
      median_session_time: 977,
      max_concurrent_users: 657,
    },
    last_30d: {
      users: 31676,
      sessions: 74392,
      median_session_time: 867,
      max_concurrent_users: 835,
    },
    retention: {
      d1: 5.4174,
      d3: 2.141,
      d7: 1.0921,
      d14: 0.5906,
      d28: 0.3098,
    },
  },
}
