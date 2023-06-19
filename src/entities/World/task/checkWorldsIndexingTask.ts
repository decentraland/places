import { Task } from "decentraland-gatsby/dist/entities/Task"

import { proceessWorldsIndexing } from "./processWorldsIndexing"

export const checkWorldsIndexingTask = new Task({
  name: "worlds_indexing",
  repeat: Task.Repeat.EachDay,
  task: async (ctx) => {
    const logger = ctx.logger
    await proceessWorldsIndexing(logger)
  },
})
