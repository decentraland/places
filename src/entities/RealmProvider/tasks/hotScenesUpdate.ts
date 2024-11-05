import { Task } from "decentraland-gatsby/dist/entities/Task"

import { fetchHotScenesAndUpdateCache } from "../utils"

export const hotScenesUpdate = new Task({
  name: "places_hot_scenes_update",
  repeat: Task.Repeat.Minutely,
  task: async (ctx) => {
    console.log("Updating hot scenes")
    ctx.logger.log("Updating hot scenes")
    await fetchHotScenesAndUpdateCache()
  },
})
