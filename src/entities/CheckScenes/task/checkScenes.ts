import SQS from "aws-sdk/clients/sqs"
import { Task } from "decentraland-gatsby/dist/entities/Task"

import { SQSConsumer } from "./consumer"
import { taskRunnerSqs } from "./taskRunnerSqs"

export function createSceneConsumerTask(
  sqs: SQS,
  params: AWS.SQS.ReceiveMessageRequest & { FromSns?: boolean }
) {
  if (!params.QueueUrl) {
    console.log("Scene consumer task is disabled")
    return null
  }
  const consumer = new SQSConsumer(sqs, params)
  return new Task({
    name: "scenes_consumer",
    repeat: Task.Repeat.Each10Seconds,
    task: async (ctx) => {
      const logger = ctx.logger
      logger.log("Start scenes_consumer")
      const sqsConsumed = await consumer.consume(taskRunnerSqs)

      if (!sqsConsumed) {
        logger.log(`Check the logs`)
        return
      }
      logger.log(JSON.stringify(sqsConsumed, null, 2))
    },
  })
}
