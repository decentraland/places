import { DeploymentToSqs } from "@dcl/schemas/dist/misc/deployments-to-sqs"
import { AsyncQueue } from "@well-known-components/pushable-channel"
import { SQS } from "aws-sdk"
import logger from "decentraland-gatsby/dist/entities/Development/logger"
import env from "decentraland-gatsby/dist/utils/env"
import delay from "decentraland-gatsby/dist/utils/promise/delay"

export interface TaskQueueMessage {
  id: string
}

export type SNSOverSQSMessage = {
  Message: string
}

export type InternalElement = {
  message: TaskQueueMessage
  job: DeploymentToSqs | null
}

class MemoryConsumer {
  async consume(
    taskRunner: (job: DeploymentToSqs) => Promise<{
      isNewPlace: boolean
      placesDisable: number
    }>
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const q = new AsyncQueue<InternalElement>((action) => void 0)
    // TODO: kill if there is nothing in next
    const it: InternalElement = (await q.next()).value
    logger.log(`Processing job`, { id: it.message.id })
    let result
    if (it.job) {
      result = await taskRunner(it.job)
    }
    return { result, message: it.message }
  }
}

class SNSConsumer {
  constructor(public sqs: SQS, public params: AWS.SQS.ReceiveMessageRequest) {}

  async consume(
    taskRunner: (job: DeploymentToSqs) => Promise<{
      isNewPlace: boolean
      placesDisable: number
    }>
  ) {
    try {
      const response = await Promise.race([
        this.sqs.receiveMessage(this.params).promise(),
        delay(30 * 60 * 1000, "Timed out sqs.receiveMessage"),
      ])

      if (
        typeof response !== "string" &&
        response?.Messages &&
        response.Messages.length > 0
      ) {
        for (const it of response.Messages) {
          const message: TaskQueueMessage = { id: it.MessageId! }
          const snsOverSqs: SNSOverSQSMessage = JSON.parse(it.Body!)
          const loggerExtended = logger.extend({
            id: message.id,
            message: snsOverSqs.Message,
            QueueUrl: env("QUEUE_ID")!,
            ReceiptHandle: it.ReceiptHandle!,
          })

          try {
            loggerExtended.log(`Processing job`)

            const result = await taskRunner(JSON.parse(snsOverSqs.Message))
            loggerExtended.log(`Processed job`)
            return { result, message }
          } catch (err: any) {
            loggerExtended.error(err)
            return { result: undefined, message }
          } finally {
            loggerExtended.log(`Deleting message`)
            await this.sqs
              .deleteMessage({
                QueueUrl: env("QUEUE_ID")!,
                ReceiptHandle: it.ReceiptHandle!,
              })
              .promise()
          }
        }
      }
    } catch (err: any) {
      logger.error(err)
    }
  }
}

export const consumer = env("QUEUE_ID")
  ? new SNSConsumer(
      new SQS({ apiVersion: "latest", region: env("AWS_REGION") }),
      {
        AttributeNames: ["SentTimestamp"],
        MaxNumberOfMessages: 1,
        MessageAttributeNames: ["All"],
        QueueUrl: env("QUEUE_ID")!,
        WaitTimeSeconds: 15,
        VisibilityTimeout: 3 * 3600, // 3 hours
      }
    )
  : new MemoryConsumer()
