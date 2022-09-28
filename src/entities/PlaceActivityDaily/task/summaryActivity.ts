import { Task } from "decentraland-gatsby/dist/entities/Task"
import Time from "decentraland-gatsby/dist/utils/date/Time"

import PlaceModel from "../../Place/model"
import PlaceActivityModel from "../../PlaceActivity/model"
import PlaceActivityDailyModel from "../model"

export const summaryActivity = new Task({
  name: "summary_activity",
  repeat: Task.Repeat.Daily,
  task: async (ctx) => {
    let latest: Date | null = null
    try {
      latest = await PlaceActivityDailyModel.findLatest()
    } catch (err) {
      ctx.logger.error(`Error loading activity summary`, err as any)
      return
    }

    const from = Time.utc(latest || 0)
      .startOf("day")
      .add(1, "day")
      .toDate()
    const to = Time.utc().startOf("day").subtract(1, "second").toDate()
    const logger = ctx.logger.extend({ from, to })
    if (from.getTime() >= to.getTime()) {
      logger.log(`skipping summary: latest summary already exists`)
      return
    }

    const summaries = await PlaceActivityModel.getSummary(from, to)
    if (summaries.length === 0) {
      logger.log(`skipping summary: no summary generated`)
      return
    }

    const created = await PlaceActivityDailyModel.createMany(summaries)
    logger.log(`created ${created} new summaries`)

    const updates = await PlaceModel.summaryActivities()
    logger.log(`updated ${updates} activity scores`)
  },
})
