import { Task } from "decentraland-gatsby/dist/entities/Task"

import { fetchWorldsLiveDataAndUpdateCache } from "../utils"

export const worldsLiveDataUpdate = new Task({
  name: "worlds_live_data",
  repeat: Task.Repeat.Minutely,
  task: async () => {
    await fetchWorldsLiveDataAndUpdateCache()
  },
})
