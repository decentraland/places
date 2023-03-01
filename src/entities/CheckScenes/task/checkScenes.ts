import { Task } from "decentraland-gatsby/dist/entities/Task"

import { consumer } from "./consumer"
import { processScenes } from "./processScenes"

export const checkScenes = new Task({
  name: "check_scenes",
  repeat: Task.Repeat.Each10Seconds, // TODO: CHANGE TO Each10Minutes
  task: async (ctx) => {
    const logger = ctx.logger
    logger.log(`Information in message`)
    const sqsConsumed = await consumer.consume(processScenes)

    if (!sqsConsumed) {
      logger.log(`Check the logs`)
      return
    }
    logger.log(JSON.stringify(sqsConsumed.message))
  },
})
