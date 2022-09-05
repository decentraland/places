import { Task } from 'decentraland-gatsby/dist/entities/Task'
import PlaceActivityDailyModel from '../model'
import Time from 'decentraland-gatsby/dist/utils/date/Time'
import PlaceActivityModel from '../../PlaceActivity/model'

export const summaryActivity = new Task({
  name: 'summary_activity',
  repeat: Task.Repeat.Daily,
  task: async (ctx) => {
    let latest: Date | null = null
    try {
      latest = await PlaceActivityDailyModel.findLatest()
    } catch (err) {
      ctx.logger.error(`Error loading activity summary`, err as any)
      return
    }

    const from = Time.utc(latest || 0).add(1, 'day').toDate()
    const to = Time.utc().startOf('day').subtract(1, 'second').toDate()
    const logger = ctx.logger.extend({ from, to })
    if (from.getDate() >= to.getDate()) {
      logger.log(`skipping summary: latest summary already exists`)
      return
    }

    try {
      const summaries = await PlaceActivityModel.getSummary(from, to)
      if (summaries.length === 0) {
        logger.log(`skipping summary: no summary generated`)
        return
      }

      const created = await PlaceActivityDailyModel.createMany(summaries)
      logger.log(`created ${created} new summaries`)
    } catch (err) {
      logger.error(`error generating summary`, err as Record<string, any>)
    }
  }
})