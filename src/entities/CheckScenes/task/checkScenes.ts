import SQS from "aws-sdk/clients/sqs"
import { Task } from "decentraland-gatsby/dist/entities/Task"

import { SQSConsumer } from "./consumer"
import { processEntityId } from "./processEntityId"

export function createSceneConsumerTask(
  sqs: SQS,
  params: AWS.SQS.ReceiveMessageRequest & { FromSns?: boolean }
) {
  if (params.QueueUrl) {
    console.log("Scene consumer task is disabled")
    return null
  }
  const consumer = new SQSConsumer(sqs, params)
  return new Task({
    name: "scenes_consumer",
    repeat: Task.Repeat.Each10Seconds, // TODO: CHANGE TO Each10Minutes
    task: async (ctx) => {
      const logger = ctx.logger
      const sqsConsumed = await consumer.consume(processEntityId)

      if (!sqsConsumed) {
        logger.log(`Check the logs`)
        return
      }
      logger.log(JSON.stringify(sqsConsumed.message))
    },
  })
}
